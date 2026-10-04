use std::fs;

use rusqlite::Connection;
use tauri::{AppHandle, Manager};

use crate::database::{self, Task};

fn open_app_database(app: &AppHandle) -> Result<Connection, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not locate FocusDesk data directory: {error}"))?;
    let db_path = app_data_dir.join("focusdesk.db");

    database::open_connection(&db_path)
        .map_err(|error| format!("Could not open the FocusDesk database: {error}"))
}

#[tauri::command]
pub fn list_inbox_tasks(app: AppHandle) -> Result<Vec<Task>, String> {
    let connection = open_app_database(&app)?;
    database::list_inbox_tasks(&connection)
        .map_err(|error| format!("Could not load inbox tasks: {error}"))
}

#[tauri::command]
pub fn create_task(app: AppHandle, title: String) -> Result<Task, String> {
    let title = title.trim();
    if title.is_empty() {
        return Err("Enter a task title before saving.".to_string());
    }
    if title.chars().count() > 500 {
        return Err("Task titles must be 500 characters or fewer.".to_string());
    }

    let connection = open_app_database(&app)?;
    database::create_task(&connection, title)
        .map_err(|error| format!("Could not save the task: {error}"))
}

#[tauri::command]
pub fn complete_task(app: AppHandle, id: String) -> Result<Task, String> {
    if id.trim().is_empty() {
        return Err("The task identifier is missing.".to_string());
    }

    let connection = open_app_database(&app)?;
    database::complete_task(&connection, &id).map_err(|error| match error {
        rusqlite::Error::QueryReturnedNoRows => {
            "This task is no longer in the inbox. Refresh the list and try again.".to_string()
        }
        other => format!("Could not complete the task: {other}"),
    })
}

pub fn initialize_app_database(app: &AppHandle) -> Result<(), String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not locate FocusDesk data directory: {error}"))?;

    fs::create_dir_all(&app_data_dir)
        .map_err(|error| format!("Could not create FocusDesk data directory: {error}"))?;

    let db_path = app_data_dir.join("focusdesk.db");
    database::initialize_database(&db_path)
        .map_err(|error| format!("Could not initialize the FocusDesk database: {error}"))
}
