mod commands;
mod database;

use commands::{
    archive_project, archive_task, complete_task, create_project, create_task,
    initialize_app_database, list_active_tasks, list_archived_tasks, list_inbox_tasks,
    list_project_tasks, list_projects, list_today_tasks, permanently_delete_archived_task,
    restore_project, restore_task, undo_task_completion, update_project, update_task,
};

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
            list_active_tasks,
            list_archived_tasks,
            list_projects,
            list_project_tasks,
            list_today_tasks,
            create_task,
            update_task,
            create_project,
            update_project,
            archive_project,
            restore_project,
            complete_task,
            undo_task_completion,
            archive_task,
            restore_task,
            permanently_delete_archived_task
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
