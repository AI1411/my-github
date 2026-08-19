use std::sync::LazyLock;

use tokio::sync::Mutex;

static SYNC_ACCOUNT_LOCK: LazyLock<Mutex<()>> = LazyLock::new(|| Mutex::new(()));

/// Serialize sync work and account switches so they cannot interleave.
pub async fn with_sync_account_lock<F, Fut, T>(f: F) -> T
where
    F: FnOnce() -> Fut,
    Fut: std::future::Future<Output = T>,
{
    let _guard = SYNC_ACCOUNT_LOCK.lock().await;
    f().await
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;
    use std::time::Duration;

    #[tokio::test]
    async fn sync_account_lock_serializes_concurrent_tasks() {
        let order = Arc::new(AtomicUsize::new(0));
        let seen = Arc::new(tokio::sync::Mutex::new(Vec::new()));

        let t1 = {
            let order = order.clone();
            let seen = seen.clone();
            tokio::spawn(async move {
                with_sync_account_lock(|| async {
                    let n = order.fetch_add(1, Ordering::SeqCst);
                    tokio::time::sleep(Duration::from_millis(50)).await;
                    seen.lock().await.push(n);
                })
                .await
            })
        };
        let t2 = {
            let order = order.clone();
            let seen = seen.clone();
            tokio::spawn(async move {
                with_sync_account_lock(|| async {
                    let n = order.fetch_add(1, Ordering::SeqCst);
                    seen.lock().await.push(n);
                })
                .await
            })
        };

        t1.await.unwrap();
        t2.await.unwrap();

        let results = seen.lock().await.clone();
        assert_eq!(results.len(), 2);
        assert_ne!(results[0], results[1]);
    }

    #[tokio::test]
    async fn sync_and_switch_paths_share_account_lock() {
        let order = Arc::new(AtomicUsize::new(0));
        let seen = Arc::new(tokio::sync::Mutex::new(Vec::new()));

        let sync_task = {
            let order = order.clone();
            let seen = seen.clone();
            tokio::spawn(async move {
                with_sync_account_lock(|| async {
                    let n = order.fetch_add(1, Ordering::SeqCst);
                    tokio::time::sleep(Duration::from_millis(40)).await;
                    seen.lock().await.push(("sync", n));
                })
                .await
            })
        };
        let switch_task = {
            let order = order.clone();
            let seen = seen.clone();
            tokio::spawn(async move {
                with_sync_account_lock(|| async {
                    let n = order.fetch_add(1, Ordering::SeqCst);
                    seen.lock().await.push(("switch", n));
                })
                .await
            })
        };

        sync_task.await.unwrap();
        switch_task.await.unwrap();

        let results = seen.lock().await.clone();
        assert_eq!(results.len(), 2);
        assert_ne!(results[0].1, results[1].1);
    }
}
