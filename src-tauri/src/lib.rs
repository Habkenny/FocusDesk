mod commands;
mod database;

use commands::{complete_task, create_task, initialize_app_database, list_inbox_tasks};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            initialize_app_database(app.handle()).map_err(std::io::Error::other)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_inbox_tasks,
            create_task,
            complete_task
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
