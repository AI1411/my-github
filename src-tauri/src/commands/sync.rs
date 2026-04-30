use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime};

use crate::auth::pat::validate_pat;
use crate::auth::token_store::{load_last_account_id, load_token};
use crate::db::SqlitePool;
use crate::github::client::RateLimitInfo;
use crate::sync::engine::SyncEngine;
use crate::sync::status::get_sync_status;
use crate::sync::types::{SyncReport, SyncScope, SyncStatus};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncNowResult {
    pub report: SyncReport,
    /// Current rate-limit snapshot after sync. `None` if we couldn't fetch it.
    pub rate_limit: Option<RateLimitInfo>,
    /// Epoch seconds at which this sync completed (client-side clock).
    pub synced_at_epoch: u64,
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
    let client = reqwest::Client::new();
    let (user, _) = validate_pat(&client, &token)
        .await
        .map_err(|err| err.to_string())?;

    SyncEngine::new(pool.inner(), token, user)
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

#[cfg(test)]
mod tests {
    use super::*;

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
    }
}
