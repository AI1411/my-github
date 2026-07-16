pub mod auth;
pub mod cache;
pub mod commands;
pub mod config;
pub mod db;
pub mod github;
pub mod sync;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            use tauri::Manager;
            let handle = app.handle().clone();
            let db_path = db::app_db_path(&handle)?;
            let pool = db::init_pool(&db_path)?;
            db::run_migrations(&pool)?;
            app.manage(pool);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            commands::auth::cmd_start_device_flow,
            commands::auth::cmd_poll_device_flow,
            commands::auth::cmd_save_pat,
            commands::auth::cmd_logout,
            commands::auth::cmd_switch_account,
            commands::auth::cmd_get_current_user,
            commands::sync::cmd_sync_now,
            commands::sync::cmd_get_sync_status,
            commands::pulls::cmd_list_pulls,
            commands::pulls::cmd_get_pull_files,
            commands::issues::cmd_list_issues,
            commands::issues::cmd_get_issue,
            commands::issues::cmd_list_issue_comments,
            commands::inbox::cmd_get_inbox,
            commands::inbox::cmd_get_notifications,
            commands::inbox::cmd_mark_notification_read,
            commands::inbox::cmd_mark_all_notifications_read,
            commands::ci::cmd_get_workflow_runs,
            commands::ci::cmd_open_run_logs,
            commands::search::cmd_search_github,
            commands::system::cmd_log_frontend_error,
            commands::system::cmd_ping,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

impl<R: tauri::Runtime> sync::poller::EventEmitter for tauri::AppHandle<R> {
    fn emit_rate_limit_hit(&self, info: &github::client::RateLimitInfo) {
        use tauri::Emitter;
        let _ = self.emit("rate-limit-hit", info);
    }
}
