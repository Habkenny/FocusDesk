use std::fs;

use tauri::{AppHandle, Manager};

use crate::database::initialize_database;

#[tauri::command]
pub fn initialize_database_command(app: AppHandle) -> Result<String, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;

    fs::create_dir_all(&app_data_dir).map_err(|error| error.to_string())?;

    let db_path = app_data_dir.join("focusdesk.db");
    initialize_database(&db_path).map_err(|error| error.to_string())?;

    Ok(db_path.display().to_string())
}

#[tauri::command]
pub fn get_app_status() -> Result<String, String> {
    Ok("FocusDesk ready".to_string())
}
