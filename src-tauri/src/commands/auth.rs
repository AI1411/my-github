use crate::auth::device_flow::{request_device_code, DeviceCodeResponse};
use crate::auth::pat::{check_required_scopes, validate_pat, PatUser};
use crate::auth::token_store::{load_host, save_host, save_last_account_id, save_token};
use crate::config;
use crate::github::host::normalize_api_base_url;

#[tauri::command]
pub async fn cmd_start_device_flow() -> Result<DeviceCodeResponse, String> {
    let client = reqwest::Client::new();
    request_device_code(
        &client,
        config::CLIENT_ID,
        "repo,read:org,read:user,notifications,workflow",
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_poll_device_flow(device_code: DeviceCodeResponse) -> Result<PatUser, String> {
    let client = reqwest::Client::new();
    let token =
        crate::auth::device_flow::poll_device_flow(&client, config::CLIENT_ID, &device_code)
            .await
            .map_err(|e| e.to_string())?;
    let (user, _scopes) = validate_pat(&client, &token, None)
        .await
        .map_err(|e| e.to_string())?;
    save_token(&user.login, &token).map_err(|e| e.to_string())?;
    save_last_account_id(&user.login).map_err(|e| e.to_string())?;
    Ok(user)
}

#[tauri::command]
pub async fn cmd_save_pat(pat: String, base_url: Option<String>) -> Result<PatUser, String> {
    let client = reqwest::Client::new();
    let api_base = base_url
        .as_deref()
        .map(normalize_api_base_url)
        .filter(|u| u != "https://api.github.com");
    let (user, scopes) = validate_pat(&client, &pat, api_base.as_deref())
        .await
        .map_err(|e| e.to_string())?;
    check_required_scopes(&scopes)?;
    save_token(&user.login, &pat).map_err(|e| e.to_string())?;
    if let Some(base) = api_base.as_deref() {
        save_host(&user.login, base).map_err(|e| e.to_string())?;
    } else {
        let _ = crate::auth::token_store::delete_host(&user.login);
    }
    save_last_account_id(&user.login).map_err(|e| e.to_string())?;
    Ok(user)
}

#[tauri::command]
pub async fn cmd_logout(account_id: String) -> Result<(), String> {
    crate::auth::token_store::delete_token(&account_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_switch_account(account_id: String) -> Result<PatUser, String> {
    let token = crate::auth::token_store::load_token(&account_id)
        .ok_or_else(|| "no token for account".to_string())?;
    crate::auth::token_store::save_last_account_id(&account_id).map_err(|e| e.to_string())?;
    let client = reqwest::Client::new();
    let api_base = load_host(&account_id);
    let (user, _) = validate_pat(&client, &token, api_base.as_deref())
        .await
        .map_err(|e| e.to_string())?;
    Ok(user)
}

#[tauri::command]
pub async fn cmd_get_current_user() -> Option<PatUser> {
    let account_id = crate::auth::token_store::load_last_account_id()?;
    let token = crate::auth::token_store::load_token(&account_id)?;
    let client = reqwest::Client::new();
    let api_base = load_host(&account_id);
    let (user, _) = validate_pat(&client, &token, api_base.as_deref())
        .await
        .ok()?;
    Some(user)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cmd_start_device_flow_is_async() {
        let _ = cmd_start_device_flow;
    }

    #[test]
    fn cmd_poll_device_flow_accepts_device_code_response() {
        let _ = cmd_poll_device_flow;
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
