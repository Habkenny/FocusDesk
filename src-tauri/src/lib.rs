mod commands;
mod database;

use commands::{get_app_status, initialize_database_command};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![initialize_database_command, get_app_status])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
