//! System tray with a mini inbox summary.
//!
//! The tray menu shows unread counts (review requests / CI failing /
//! mentions) and lets the user reopen the main window on the Inbox page.
//! Counts are pushed from the frontend via [`cmd_update_tray_summary`]
//! whenever inbox data is refreshed.

use std::sync::Mutex;

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIcon;
use tauri::{AppHandle, Emitter, Manager, Runtime};

pub struct TrayState<R: Runtime>(pub Mutex<Option<TrayIcon<R>>>);

const OPEN_INBOX_ID: &str = "tray-open-inbox";

/// Menu labels for the summary section, shared by build & tests.
pub fn summary_labels(review_requests: u32, ci_failures: u32, mentions: u32) -> Vec<String> {
    vec![
        format!("Review requests: {review_requests}"),
        format!("CI failing: {ci_failures}"),
        format!("Mentions: {mentions}"),
    ]
}

fn build_menu<R: Runtime>(
    app: &AppHandle<R>,
    review_requests: u32,
    ci_failures: u32,
    mentions: u32,
) -> tauri::Result<Menu<R>> {
    let labels = summary_labels(review_requests, ci_failures, mentions);
    let mut items: Vec<Box<dyn tauri::menu::IsMenuItem<R>>> = Vec::new();
    for (index, label) in labels.iter().enumerate() {
        items.push(Box::new(MenuItem::with_id(
            app,
            format!("tray-summary-{index}"),
            label,
            false,
            None::<&str>,
        )?));
    }
    items.push(Box::new(PredefinedMenuItem::separator(app)?));
    items.push(Box::new(MenuItem::with_id(
        app,
        OPEN_INBOX_ID,
        "Open Inbox",
        true,
        None::<&str>,
    )?));
    items.push(Box::new(PredefinedMenuItem::quit(app, None)?));
    let refs: Vec<&dyn tauri::menu::IsMenuItem<R>> = items.iter().map(|i| i.as_ref()).collect();
    Menu::with_items(app, &refs)
}

fn open_inbox<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
    let _ = app.emit("tray-open-inbox", ());
}

/// Creates the tray icon with an empty summary. Called once at startup.
pub fn init<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let menu = build_menu(app, 0, 0, 0)?;
    let mut builder = tauri::tray::TrayIconBuilder::with_id("pulse-tray")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| {
            if event.id.as_ref() == OPEN_INBOX_ID {
                open_inbox(app);
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    let tray = builder.build(app)?;
    app.manage(TrayState(Mutex::new(Some(tray))));
    Ok(())
}

/// Frontend pushes fresh inbox counts; the tray menu is rebuilt in place.
#[tauri::command]
pub fn cmd_update_tray_summary<R: Runtime>(
    app: AppHandle<R>,
    review_requests: u32,
    ci_failures: u32,
    mentions: u32,
) -> Result<(), String> {
    let state = app
        .try_state::<TrayState<R>>()
        .ok_or_else(|| "tray not initialized".to_string())?;
    let menu =
        build_menu(&app, review_requests, ci_failures, mentions).map_err(|e| e.to_string())?;
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(tray) = guard.as_ref() {
        tray.set_menu(Some(menu)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn summary_labels_format_counts() {
        assert_eq!(
            summary_labels(2, 1, 0),
            vec!["Review requests: 2", "CI failing: 1", "Mentions: 0"]
        );
    }

    #[test]
    fn summary_labels_always_three_lines() {
        assert_eq!(summary_labels(0, 0, 0).len(), 3);
    }
}
