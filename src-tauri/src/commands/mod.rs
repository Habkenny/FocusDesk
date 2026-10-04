use std::fs;

use rusqlite::Connection;
use tauri::{AppHandle, Manager};

use crate::database::{self, Task, TaskInput};

fn open_app_database(app: &AppHandle) -> Result<Connection, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not locate FocusDesk data directory: {error}"))?;
    let db_path = app_data_dir.join("focusdesk.db");

    database::open_connection(&db_path).map_err(|error| {
        eprintln!("Failed to open FocusDesk database: {error}");
        "The local database could not be opened. Your existing data has not been changed."
            .to_string()
    })
}

fn validate_task_input(mut input: TaskInput) -> Result<TaskInput, String> {
    input.title = input.title.trim().to_string();
    if input.title.is_empty() {
        return Err("Enter a task title before saving.".to_string());
    }
    if input.title.chars().count() > 500 {
        return Err("Task titles must be 500 characters or fewer.".to_string());
    }
    if input
        .description
        .as_ref()
        .is_some_and(|description| description.chars().count() > 10_000)
    {
        return Err("Task descriptions must be 10,000 characters or fewer.".to_string());
    }
    if !matches!(
        input.priority.as_str(),
        "NONE" | "LOW" | "MEDIUM" | "HIGH" | "URGENT"
    ) {
        return Err("Choose a valid task priority.".to_string());
    }
    if input
        .status
        .as_deref()
        .is_some_and(|status| !matches!(status, "INBOX" | "TODO" | "IN_PROGRESS"))
    {
        return Err("Choose a valid task status.".to_string());
    }
    if input
        .due_at
        .as_deref()
        .is_some_and(|date| !is_valid_date(date))
    {
        return Err("Choose a valid due date.".to_string());
    }

    if let Some(description) = input.description.as_mut() {
        let trimmed = description.trim();
        *description = if trimmed.is_empty() {
            String::new()
        } else {
            trimmed.to_string()
        };
    }

    Ok(input)
}

fn is_valid_date(value: &str) -> bool {
    let bytes = value.as_bytes();
    if bytes.len() != 10
        || bytes[4] != b'-'
        || bytes[7] != b'-'
        || !bytes
            .iter()
            .enumerate()
            .all(|(index, byte)| matches!(index, 4 | 7) || byte.is_ascii_digit())
    {
        return false;
    }

    let year = value[0..4].parse::<u32>().ok();
    let month = value[5..7].parse::<u32>().ok();
    let day = value[8..10].parse::<u32>().ok();
    let (Some(year), Some(month), Some(day)) = (year, month, day) else {
        return false;
    };

    let month_days = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if year % 400 == 0 || (year % 4 == 0 && year % 100 != 0) => 29,
        2 => 28,
        _ => return false,
    };

    (1..=month_days).contains(&day)
}

fn map_database_error(operation: &str, error: rusqlite::Error) -> String {
    eprintln!("Failed to {operation} FocusDesk task: {error}");
    match error {
        rusqlite::Error::QueryReturnedNoRows => {
            "This task is no longer available. Refresh the list and try again.".to_string()
        }
        _ => format!("The task could not be {operation}. Your saved data is unchanged."),
    }
}

#[tauri::command]
pub fn list_inbox_tasks(app: AppHandle) -> Result<Vec<Task>, String> {
    let connection = open_app_database(&app)?;
    database::list_inbox_tasks(&connection).map_err(|error| {
        eprintln!("Failed to load FocusDesk inbox tasks: {error}");
        "Your inbox could not be loaded. Your saved data has not been changed.".to_string()
    })
}

#[tauri::command]
pub fn list_today_tasks(app: AppHandle, today: String) -> Result<Vec<Task>, String> {
    if !is_valid_date(&today) {
        return Err("A valid local date is required to load Today.".to_string());
    }

    let connection = open_app_database(&app)?;
    database::list_today_tasks(&connection, &today).map_err(|error| {
        eprintln!("Failed to load FocusDesk Today tasks: {error}");
        "Today’s tasks could not be loaded. Your saved data has not been changed.".to_string()
    })
}

#[tauri::command]
pub fn create_task(app: AppHandle, input: TaskInput) -> Result<Task, String> {
    let input = validate_task_input(input)?;
    let connection = open_app_database(&app)?;
    database::create_task(&connection, &input).map_err(|error| map_database_error("saved", error))
}

#[tauri::command]
pub fn update_task(app: AppHandle, id: String, input: TaskInput) -> Result<Task, String> {
    if id.trim().is_empty() {
        return Err("The task identifier is missing.".to_string());
    }
    let input = validate_task_input(input)?;
    let connection = open_app_database(&app)?;
    database::update_task(&connection, &id, &input)
        .map_err(|error| map_database_error("updated", error))
}

#[tauri::command]
pub fn complete_task(app: AppHandle, id: String) -> Result<Task, String> {
    if id.trim().is_empty() {
        return Err("The task identifier is missing.".to_string());
    }
    let connection = open_app_database(&app)?;
    database::complete_task(&connection, &id)
        .map_err(|error| map_database_error("completed", error))
}

#[tauri::command]
pub fn undo_task_completion(app: AppHandle, id: String) -> Result<Task, String> {
    if id.trim().is_empty() {
        return Err("The task identifier is missing.".to_string());
    }
    let connection = open_app_database(&app)?;
    database::undo_completion(&connection, &id)
        .map_err(|error| map_database_error("restored", error))
}

#[tauri::command]
pub fn archive_task(app: AppHandle, id: String) -> Result<Task, String> {
    if id.trim().is_empty() {
        return Err("The task identifier is missing.".to_string());
    }
    let connection = open_app_database(&app)?;
    database::archive_task(&connection, &id).map_err(|error| map_database_error("archived", error))
}

#[tauri::command]
pub fn restore_task(app: AppHandle, id: String) -> Result<Task, String> {
    if id.trim().is_empty() {
        return Err("The task identifier is missing.".to_string());
    }
    let connection = open_app_database(&app)?;
    database::restore_task(&connection, &id).map_err(|error| map_database_error("restored", error))
}

pub fn initialize_app_database(app: &AppHandle) -> Result<(), String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not locate FocusDesk data directory: {error}"))?;

    fs::create_dir_all(&app_data_dir).map_err(|error| {
        eprintln!("Failed to create FocusDesk app data directory: {error}");
        "FocusDesk could not create its local data directory. Check that the app has permission to write to your user profile.".to_string()
    })?;

    let db_path = app_data_dir.join("focusdesk.db");
    database::initialize_database(&db_path).map_err(|error| {
        eprintln!("Failed to initialize FocusDesk database: {error}");
        "FocusDesk could not safely initialize its database. Existing data has not been removed."
            .to_string()
    })
}

#[cfg(test)]
mod tests {
    use super::{is_valid_date, validate_task_input};
    use crate::database::TaskInput;

    #[test]
    fn validates_dates_and_task_fields() {
        assert!(is_valid_date("2024-02-29"));
        assert!(!is_valid_date("2025-02-29"));
        assert!(!is_valid_date("2025-13-01"));

        let input = validate_task_input(TaskInput {
            title: "  Valid title  ".to_string(),
            description: Some("  details  ".to_string()),
            priority: "HIGH".to_string(),
            due_at: Some("2025-12-31".to_string()),
            status: Some("TODO".to_string()),
        })
        .expect("valid task input should be accepted");

        assert_eq!(input.title, "Valid title");
        assert_eq!(input.description.as_deref(), Some("details"));
    }
}
