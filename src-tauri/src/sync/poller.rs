use std::future::Future;
use std::sync::Arc;
use std::time::Duration;

use tokio::task::JoinHandle;
use tokio::time::{interval, MissedTickBehavior};

use crate::github::client::RateLimitInfo;

/// Default my-github polling interval when the app window is focused.
pub const DEFAULT_POLL_INTERVAL: Duration = Duration::from_secs(60);

/// Spawn a polling loop that invokes `tick` at `period` intervals.
///
/// The first tick fires immediately (tokio's interval semantics). If a tick
/// runs longer than `period`, subsequent ticks are delayed rather than
/// bursting (`MissedTickBehavior::Delay`).
///
/// Call `.abort()` on the returned handle to stop the loop.
pub fn spawn_poller<F, Fut>(period: Duration, tick: F) -> JoinHandle<()>
where
    F: Fn() -> Fut + Send + Sync + 'static,
    Fut: Future<Output = ()> + Send + 'static,
{
    let tick = Arc::new(tick);
    tokio::spawn(async move {
        let mut ticker = interval(period);
        ticker.set_missed_tick_behavior(MissedTickBehavior::Delay);
        loop {
            ticker.tick().await;
            (tick)().await;
        }
    })
}

/// Outcome returned by a tick of the rate-limit aware poller.
#[derive(Debug, Clone)]
pub enum PollOutcome {
    Ok,
    RateLimited(RateLimitInfo),
}

/// Abstraction over the host's event bus so the poller can emit UI events
/// without depending on Tauri directly. Tauri's `AppHandle` implements this
/// in `lib.rs`.
pub trait EventEmitter: Send + Sync + 'static {
    fn emit_rate_limit_hit(&self, info: &RateLimitInfo);
}

/// Spawn a polling loop that respects GitHub rate limits.
///
/// If the tick returns `PollOutcome::RateLimited(info)`, the emitter is
/// notified via `emit_rate_limit_hit(&info)` and the next tick is awaited
/// as normal (i.e. the current tick contributes no sync work).
pub fn spawn_rate_limited_poller<E, F, Fut>(
    period: Duration,
    emitter: Arc<E>,
    tick: F,
) -> JoinHandle<()>
where
    E: EventEmitter,
    F: Fn() -> Fut + Send + Sync + 'static,
    Fut: Future<Output = PollOutcome> + Send + 'static,
{
    let tick = Arc::new(tick);
    tokio::spawn(async move {
        let mut ticker = interval(period);
        ticker.set_missed_tick_behavior(MissedTickBehavior::Delay);
        loop {
            ticker.tick().await;
            match (tick)().await {
                PollOutcome::Ok => {}
                PollOutcome::RateLimited(info) => {
                    emitter.emit_rate_limit_hit(&info);
                }
            }
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    #[tokio::test(flavor = "current_thread", start_paused = true)]
    async fn poller_ticks_on_interval() {
        let counter = Arc::new(AtomicUsize::new(0));
        let c = counter.clone();
        let handle = spawn_poller(Duration::from_secs(1), move || {
            let c = c.clone();
            async move {
                c.fetch_add(1, Ordering::SeqCst);
            }
        });

        // Yield so the immediately-ready first tick can run.
        tokio::task::yield_now().await;
        tokio::task::yield_now().await;
        assert_eq!(counter.load(Ordering::SeqCst), 1);

        tokio::time::advance(Duration::from_secs(1)).await;
        tokio::task::yield_now().await;
        tokio::task::yield_now().await;
        assert_eq!(counter.load(Ordering::SeqCst), 2);

        tokio::time::advance(Duration::from_secs(2)).await;
        tokio::task::yield_now().await;
        tokio::task::yield_now().await;
        assert!(counter.load(Ordering::SeqCst) >= 3);

        handle.abort();
    }

    #[tokio::test(flavor = "current_thread")]
    async fn abort_stops_the_loop() {
        let counter = Arc::new(AtomicUsize::new(0));
        let c = counter.clone();
        let handle = spawn_poller(Duration::from_millis(10), move || {
            let c = c.clone();
            async move {
                c.fetch_add(1, Ordering::SeqCst);
            }
        });
        tokio::time::sleep(Duration::from_millis(50)).await;
        handle.abort();
        let seen = counter.load(Ordering::SeqCst);
        tokio::time::sleep(Duration::from_millis(50)).await;
        // After abort, counter should not keep climbing (allow +1 for an
        // in-flight tick that already awaited its future).
        assert!(counter.load(Ordering::SeqCst) <= seen + 1);
    }

    #[test]
    fn default_poll_interval_is_60s() {
        assert_eq!(DEFAULT_POLL_INTERVAL, Duration::from_secs(60));
    }

    #[tokio::test(flavor = "current_thread", start_paused = true)]
    async fn rate_limited_outcome_emits_event_and_skips() {
        use crate::github::client::RateLimitInfo;
        use std::sync::Mutex;

        #[derive(Default)]
        struct MockEmitter {
            hits: Mutex<Vec<RateLimitInfo>>,
        }
        impl EventEmitter for MockEmitter {
            fn emit_rate_limit_hit(&self, info: &RateLimitInfo) {
                self.hits.lock().unwrap().push(info.clone());
            }
        }

        let emitter = Arc::new(MockEmitter::default());
        let tick_count = Arc::new(AtomicUsize::new(0));
        let tick_clone = tick_count.clone();

        let handle =
            spawn_rate_limited_poller(Duration::from_secs(1), emitter.clone(), move || {
                let c = tick_clone.clone();
                async move {
                    let n = c.fetch_add(1, Ordering::SeqCst);
                    if n == 0 {
                        PollOutcome::RateLimited(RateLimitInfo {
                            remaining: 0,
                            reset: 123,
                        })
                    } else {
                        PollOutcome::Ok
                    }
                }
            });

        tokio::task::yield_now().await;
        tokio::task::yield_now().await;
        assert_eq!(tick_count.load(Ordering::SeqCst), 1);
        assert_eq!(emitter.hits.lock().unwrap().len(), 1);
        assert_eq!(emitter.hits.lock().unwrap()[0].remaining, 0);

        tokio::time::advance(Duration::from_secs(1)).await;
        tokio::task::yield_now().await;
        tokio::task::yield_now().await;
        assert_eq!(tick_count.load(Ordering::SeqCst), 2);
        assert_eq!(emitter.hits.lock().unwrap().len(), 1);

        handle.abort();
    }
}
