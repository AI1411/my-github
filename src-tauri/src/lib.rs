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
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            use tauri::Manager;
            let handle = app.handle().clone();
            let db_path = db::pulse_db_path(&handle)?;
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
            commands::auth::cmd_get_current_user,
            commands::sync::cmd_sync_now,
            commands::pulls::cmd_list_pulls,
            commands::pulls::cmd_get_pull_files,
            commands::issues::cmd_list_issues,
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
