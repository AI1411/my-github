pub mod auth;
pub mod commands;
pub mod config;
pub mod db;
pub mod github;

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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
