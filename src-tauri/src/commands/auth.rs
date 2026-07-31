use crate::auth::pat::{check_required_scopes, validate_pat, PatUser};
use crate::auth::token_store::{save_last_account_id, save_token};

#[tauri::command]
pub async fn cmd_save_pat(pat: String) -> Result<PatUser, String> {
    let client = reqwest::Client::new();
    let (user, scopes) = validate_pat(&client, &pat)
        .await
        .map_err(|e| e.to_string())?;
    check_required_scopes(&scopes)?;
    save_token(&user.login, &pat).map_err(|e| e.to_string())?;
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
    let (user, _) = validate_pat(&client, &token)
        .await
        .map_err(|e| e.to_string())?;
    Ok(user)
}

#[tauri::command]
pub async fn cmd_get_current_user() -> Option<PatUser> {
    let account_id = crate::auth::token_store::load_last_account_id()?;
    let token = crate::auth::token_store::load_token(&account_id)?;
    let client = reqwest::Client::new();
    let (user, _) = validate_pat(&client, &token).await.ok()?;
    Some(user)
}

#[cfg(test)]
mod tests {
    use super::*;

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
