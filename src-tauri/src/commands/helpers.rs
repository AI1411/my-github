use tauri::{AppHandle, Manager, Runtime, State};

use crate::auth::token_store::{load_last_account_id, load_token};
use crate::db::SqlitePool;

/// Resolve the SQLite pool from Tauri managed state.
pub fn get_pool<R: Runtime>(app: &AppHandle<R>) -> Result<State<'_, SqlitePool>, String> {
    app.try_state::<SqlitePool>()
        .ok_or_else(|| "sqlite pool not initialized".to_string())
}

/// Active account id + PAT for sync and other account-scoped commands.
pub fn require_active_token() -> Result<(String, String), String> {
    let account_id = load_last_account_id().ok_or_else(|| "no signed-in account".to_string())?;
    let token = load_token(&account_id).ok_or_else(|| "no token for account".to_string())?;
    Ok((account_id, token))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn require_active_token_is_function() {
        let _ = require_active_token;
    }

    #[test]
    fn get_pool_is_function() {
        let _ = get_pool::<tauri::Wry>;
    }
}
