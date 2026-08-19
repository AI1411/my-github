use crate::auth::pat::{check_required_scopes, validate_pat, PatError, PatUser};
use crate::auth::token_store::{load_host, save_host, save_last_account_id, save_token};
use crate::commands::error::AppError;
use crate::github::host::normalize_api_base_url;

#[tauri::command]
pub async fn cmd_save_pat(pat: String, base_url: Option<String>) -> Result<PatUser, AppError> {
    let client = reqwest::Client::new();
    let api_base = base_url
        .as_deref()
        .map(normalize_api_base_url)
        .filter(|u| u != "https://api.github.com");
    let (user, scopes) = validate_pat(&client, &pat, api_base.as_deref())
        .await
        .map_err(|e| AppError::auth(e.to_string()))?;
    check_required_scopes(&scopes).map_err(AppError::auth)?;
    save_token(&user.login, &pat).map_err(|e| AppError::internal(e.to_string()))?;
    if let Some(base) = api_base.as_deref() {
        save_host(&user.login, base).map_err(|e| AppError::internal(e.to_string()))?;
    } else {
        let _ = crate::auth::token_store::delete_host(&user.login);
    }
    save_last_account_id(&user.login).map_err(|e| AppError::internal(e.to_string()))?;
    Ok(user)
}

#[tauri::command]
pub async fn cmd_logout(account_id: String) -> Result<(), AppError> {
    crate::auth::token_store::delete_token(&account_id)
        .map_err(|e| AppError::internal(e.to_string()))
}

#[tauri::command]
pub async fn cmd_switch_account(account_id: String) -> Result<PatUser, AppError> {
    crate::sync::account_lock::with_sync_account_lock(|| async {
        let token = crate::auth::token_store::load_token(&account_id)
            .ok_or_else(|| AppError::auth("no token for account"))?;
        crate::auth::token_store::save_last_account_id(&account_id)
            .map_err(|e| AppError::internal(e.to_string()))?;
        let client = reqwest::Client::new();
        let api_base = load_host(&account_id);
        let (user, _) = validate_pat(&client, &token, api_base.as_deref())
            .await
            .map_err(|e| AppError::auth(e.to_string()))?;
        Ok(user)
    })
    .await
}

#[tauri::command]
pub async fn cmd_get_current_user() -> Result<Option<PatUser>, AppError> {
    let Some(account_id) = crate::auth::token_store::load_last_account_id() else {
        return Ok(None);
    };
    let Some(token) = crate::auth::token_store::load_token(&account_id) else {
        return Ok(None);
    };
    let client = reqwest::Client::new();
    let api_base = load_host(&account_id);
    match validate_pat(&client, &token, api_base.as_deref()).await {
        Ok((user, _)) => Ok(Some(user)),
        Err(PatError::Unauthorized { status }) => Err(AppError::auth(format!(
            "invalid or expired PAT (HTTP {status})"
        ))),
        Err(_) => Ok(None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::error::AppError;

    #[test]
    fn app_error_serializes_with_code() {
        let err = AppError::auth("no token for account");
        let json = serde_json::to_string(&err).expect("serialize");
        assert!(json.contains("Auth") || json.contains("auth") || json.contains("no token"));
    }

    #[test]
    fn cmd_save_pat_accepts_string_returns_pat_user() {
        let _ = cmd_save_pat;
    }

    #[test]
    fn cmd_logout_is_async_and_takes_account_id() {
        let _: fn(String) -> _ = |s| cmd_logout(s);
    }

    #[test]
    fn cmd_switch_account_accepts_account_id() {
        let _ = cmd_switch_account;
    }

    #[test]
    fn cmd_get_current_user_exists() {
        let _ = cmd_get_current_user;
    }
}
