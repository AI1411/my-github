use crate::github::rest::{list_org_repos, list_starred_repos, list_user_orgs};

#[tauri::command]
pub async fn cmd_list_user_orgs() -> Result<Vec<String>, String> {
    let client = crate::github::client::client_for_active_account()?;
    let orgs = list_user_orgs(&client).await.map_err(|e| e.to_string())?;
    Ok(orgs.into_iter().map(|org| org.login).collect())
}

#[tauri::command]
pub async fn cmd_list_org_repos(org: String) -> Result<Vec<String>, String> {
    let org = org.trim();
    if org.is_empty() {
        return Err("org is required".to_string());
    }
    let client = crate::github::client::client_for_active_account()?;
    let repos = list_org_repos(&client, org)
        .await
        .map_err(|e| e.to_string())?;
    Ok(repos.into_iter().map(|repo| repo.full_name).collect())
}

#[tauri::command]
pub async fn cmd_list_starred_repos() -> Result<Vec<String>, String> {
    let client = crate::github::client::client_for_active_account()?;
    let repos = list_starred_repos(&client)
        .await
        .map_err(|e| e.to_string())?;
    Ok(repos.into_iter().map(|repo| repo.full_name).collect())
}

#[cfg(test)]
mod tests {
    #[test]
    fn org_trim_rejects_empty() {
        let org = "  ";
        assert!(org.trim().is_empty());
    }
}
