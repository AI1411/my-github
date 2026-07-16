use std::time::{Duration, SystemTime, UNIX_EPOCH};

use rusqlite::params;
use tauri::{AppHandle, Manager, Runtime};

use crate::db::SqlitePool;

fn now_epoch_secs() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
        .to_string()
}

pub fn log_frontend_error(
    pool: &SqlitePool,
    message: &str,
    stack: Option<&str>,
    component_stack: Option<&str>,
    url: Option<&str>,
) -> Result<(), String> {
    if message.trim().is_empty() {
        return Err("message is required".to_string());
    }
    let conn = pool.get().map_err(|error| error.to_string())?;
    conn.execute(
        "INSERT INTO error_logs (message, stack, component_stack, url, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![message, stack, component_stack, url, now_epoch_secs()],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn cmd_log_frontend_error<R: Runtime>(
    app: AppHandle<R>,
    message: String,
    stack: Option<String>,
    component_stack: Option<String>,
    url: Option<String>,
) -> Result<(), String> {
    let pool = app
        .try_state::<SqlitePool>()
        .ok_or_else(|| "db not initialized".to_string())?;
    log_frontend_error(
        pool.inner(),
        &message,
        stack.as_deref(),
        component_stack.as_deref(),
        url.as_deref(),
    )
}

#[tauri::command]
pub async fn cmd_ping() -> Result<bool, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(3))
        .build()
        .map_err(|error| error.to_string())?;
    let response = client
        .get("https://api.github.com/rate_limit")
        .header(reqwest::header::USER_AGENT, "my-github")
        .send()
        .await;
    Ok(response
        .map(|response| response.status().is_success())
        .unwrap_or(false))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{init_pool, run_migrations};
    use std::path::Path;

    #[test]
    fn log_frontend_error_inserts_row() {
        let pool = init_pool(Path::new(":memory:")).unwrap();
        run_migrations(&pool).unwrap();

        log_frontend_error(
            &pool,
            "Render failed",
            Some("stack"),
            Some("component stack"),
            Some("app://settings"),
        )
        .unwrap();

        let conn = pool.get().unwrap();
        let (message, stack, component_stack, url): (
            String,
            Option<String>,
            Option<String>,
            Option<String>,
        ) = conn
            .query_row(
                "SELECT message, stack, component_stack, url FROM error_logs LIMIT 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .unwrap();
        assert_eq!(message, "Render failed");
        assert_eq!(stack.as_deref(), Some("stack"));
        assert_eq!(component_stack.as_deref(), Some("component stack"));
        assert_eq!(url.as_deref(), Some("app://settings"));
    }

    #[test]
    fn log_frontend_error_rejects_empty_message() {
        let pool = init_pool(Path::new(":memory:")).unwrap();
        run_migrations(&pool).unwrap();

        let err = log_frontend_error(&pool, "", None, None, None).unwrap_err();

        assert!(err.contains("message is required"));
    }

    #[test]
    fn cmd_ping_is_async_command() {
        let _ = cmd_ping;
    }
}
