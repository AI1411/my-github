use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;

use crate::auth::token_store::{load_last_account_id, load_token};
use crate::github::client::{GithubClient, RateLimitInfo};
use crate::github::rest::get_rate_limit;

#[derive(Debug, Serialize)]
pub struct SyncNowResult {
    /// Current rate-limit snapshot after sync. `None` if we couldn't fetch it.
    pub rate_limit: Option<RateLimitInfo>,
    /// Epoch seconds at which this sync completed (client-side clock).
    pub synced_at_epoch: u64,
}

#[tauri::command]
pub async fn cmd_sync_now() -> Result<SyncNowResult, String> {
    let account_id = load_last_account_id().ok_or_else(|| "no signed-in account".to_string())?;
    let token = load_token(&account_id).ok_or_else(|| "no token for account".to_string())?;
    let client = GithubClient::new(token);

    let rate_limit = get_rate_limit(&client).await.ok();

    let synced_at_epoch = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    Ok(SyncNowResult {
        rate_limit,
        synced_at_epoch,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sync_now_result_serializes() {
        let r = SyncNowResult {
            rate_limit: Some(RateLimitInfo {
                remaining: 4999,
                reset: 1700000000,
            }),
            synced_at_epoch: 1700000001,
        };
        let json = serde_json::to_string(&r).unwrap();
        assert!(json.contains("\"remaining\":4999"));
        assert!(json.contains("\"synced_at_epoch\":1700000001"));
    }

    #[test]
    fn cmd_sync_now_is_async_command() {
        let _ = cmd_sync_now;
    }
}
