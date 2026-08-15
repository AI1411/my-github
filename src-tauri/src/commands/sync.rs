use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime};

use crate::auth::pat::validate_pat;
use crate::auth::token_store::{load_last_account_id, load_token};
use crate::db::SqlitePool;
use crate::github::client::RateLimitInfo;
use crate::sync::engine::SyncEngine;
use crate::sync::status::get_sync_status;
use crate::sync::types::{SyncReport, SyncScope, SyncStatus};

/// Cap used when push-assisted mode is on and the window is focused.
pub const PUSH_ASSISTED_FOCUSED_POLL_SECONDS: u64 = 30;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SyncModeKind {
    Poll,
    PushAssisted,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncModeInfo {
    /// `"poll"` or `"push-assisted"`. Push-assisted is **not** GitHub webhooks —
    /// it means focus/resume revalidation plus an optional shorter focused poll.
    pub mode: SyncModeKind,
    /// Effective poll interval in seconds (`0` = polling off).
    pub polling_seconds: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncNowResult {
    pub report: SyncReport,
    /// Current rate-limit snapshot after sync. `None` if we couldn't fetch it.
    pub rate_limit: Option<RateLimitInfo>,
    /// Epoch seconds at which this sync completed (client-side clock).
    pub synced_at_epoch: u64,
}

/// Resolve the effective sync mode for the desktop MVP.
///
/// Real inbound GitHub webhooks are not implemented. `push_sync_enabled`
/// selects push-assisted behavior: callers should sync on focus/resume and
/// may use a shorter poll while focused.
pub fn resolve_sync_mode(
    push_sync_enabled: bool,
    base_polling_seconds: u64,
    focused: bool,
) -> SyncModeInfo {
    let mode = if push_sync_enabled {
        SyncModeKind::PushAssisted
    } else {
        SyncModeKind::Poll
    };
    let polling_seconds = if base_polling_seconds == 0 {
        0
    } else if push_sync_enabled && focused {
        base_polling_seconds.min(PUSH_ASSISTED_FOCUSED_POLL_SECONDS)
    } else {
        base_polling_seconds
    };
    SyncModeInfo {
        mode,
        polling_seconds,
    }
}

pub async fn run_sync_for_scopes<R: Runtime>(
    app: &AppHandle<R>,
    scopes: &[SyncScope],
) -> Result<SyncReport, String> {
    let pool = app
        .try_state::<SqlitePool>()
        .ok_or_else(|| "sqlite pool not initialized".to_string())?;
    let account_id = load_last_account_id().ok_or_else(|| "no signed-in account".to_string())?;
    let token = load_token(&account_id).ok_or_else(|| "no token for account".to_string())?;
    let api_base = crate::auth::token_store::load_host(&account_id);
    let client = reqwest::Client::new();
    let (user, _) = validate_pat(&client, &token, api_base.as_deref())
        .await
        .map_err(|err| err.to_string())?;

    SyncEngine::new(pool.inner(), token, user, api_base)
        .sync_now(scopes)
        .await
}

#[tauri::command]
pub async fn cmd_sync_now<R: Runtime>(app: AppHandle<R>) -> Result<SyncNowResult, String> {
    let report = run_sync_for_scopes(
        &app,
        &[SyncScope::Repositories, SyncScope::Pulls, SyncScope::Issues],
    )
    .await?;

    Ok(SyncNowResult {
        rate_limit: report.rate_limit.clone(),
        synced_at_epoch: report.finished_at_epoch,
        report,
    })
}

#[tauri::command]
pub fn cmd_get_sync_status<R: Runtime>(app: AppHandle<R>) -> Result<SyncStatus, String> {
    let pool = app
        .try_state::<SqlitePool>()
        .ok_or_else(|| "sqlite pool not initialized".to_string())?;
    get_sync_status(pool.inner()).map_err(|err| err.to_string())
}

/// Returns the effective sync mode for the given preferences.
///
/// Desktop apps cannot host a durable public webhook endpoint easily; this
/// command describes the **push-assisted** MVP (focus sync + adaptive poll),
/// not inbound GitHub webhooks.
#[tauri::command]
pub fn cmd_get_sync_mode(
    push_sync_enabled: bool,
    polling_seconds: u64,
    focused: bool,
) -> SyncModeInfo {
    resolve_sync_mode(push_sync_enabled, polling_seconds, focused)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sync_mode_poll_keeps_base_interval() {
        let info = resolve_sync_mode(false, 60, true);
        assert_eq!(info.mode, SyncModeKind::Poll);
        assert_eq!(info.polling_seconds, 60);
    }

    #[test]
    fn sync_mode_push_assisted_caps_when_focused() {
        let info = resolve_sync_mode(true, 60, true);
        assert_eq!(info.mode, SyncModeKind::PushAssisted);
        assert_eq!(info.polling_seconds, PUSH_ASSISTED_FOCUSED_POLL_SECONDS);

        let unfocused = resolve_sync_mode(true, 60, false);
        assert_eq!(unfocused.mode, SyncModeKind::PushAssisted);
        assert_eq!(unfocused.polling_seconds, 60);
    }

    #[test]
    fn sync_mode_serializes_kebab_and_camel() {
        let info = resolve_sync_mode(true, 300, true);
        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("\"mode\":\"push-assisted\""));
        assert!(json.contains("\"pollingSeconds\":30"));
    }

    #[test]
    fn sync_now_result_serializes_report_and_legacy_rate_limit() {
        let report = crate::sync::types::SyncReport {
            started_at_epoch: 1700000000,
            finished_at_epoch: 1700000001,
            rate_limit: Some(RateLimitInfo {
                remaining: 4999,
                reset: 1700000000,
            }),
            steps: vec![crate::sync::types::SyncStepReport::success(
                crate::sync::types::SyncScope::Repositories,
                2,
                2,
            )],
        };
        let r = SyncNowResult {
            report: report.clone(),
            rate_limit: report.rate_limit.clone(),
            synced_at_epoch: report.finished_at_epoch,
        };
        let json = serde_json::to_string(&r).unwrap();
        assert!(json.contains("\"report\":"));
        assert!(json.contains("\"finishedAtEpoch\":1700000001"));
        assert!(json.contains("\"rateLimit\":{\"remaining\":4999"));
        assert!(json.contains("\"remaining\":4999"));
        assert!(json.contains("\"syncedAtEpoch\":1700000001"));
    }

    #[test]
    fn commands_exist() {
        let _ = cmd_sync_now::<tauri::Wry>;
        let _ = cmd_get_sync_status::<tauri::Wry>;
        let _ = cmd_get_sync_mode;
    }
}
