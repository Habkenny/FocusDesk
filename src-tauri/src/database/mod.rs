use std::path::Path;

use rusqlite::Connection;

pub fn initialize_database(db_path: &Path) -> Result<(), Box<dyn std::error::Error>> {
    let connection = Connection::open(db_path)?;

    connection.execute_batch(
        r#"
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            status TEXT NOT NULL DEFAULT 'ACTIVE',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT NOT NULL DEFAULT 'INBOX',
            priority TEXT NOT NULL DEFAULT 'NONE',
            project_id TEXT,
            due_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            completed_at TEXT,
            archived_at TEXT,
            FOREIGN KEY (project_id) REFERENCES projects(id)
        );
        "#,
    )?;

    Ok(())
}
