use std::path::Path;

use rusqlite::{params, Connection, Result};
use serde::Serialize;

const CURRENT_SCHEMA_VERSION: i64 = 1;

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub title: String,
    pub status: String,
    pub priority: String,
    pub created_at: String,
    pub updated_at: String,
    pub completed_at: Option<String>,
}

pub fn open_connection(db_path: &Path) -> Result<Connection> {
    let connection = Connection::open(db_path)?;
    connection.execute_batch("PRAGMA foreign_keys = ON;")?;
    Ok(connection)
}

pub fn initialize_database(db_path: &Path) -> std::result::Result<(), Box<dyn std::error::Error>> {
    let connection = open_connection(db_path)?;
    let version: i64 = connection.query_row("PRAGMA user_version", [], |row| row.get(0))?;

    if version > CURRENT_SCHEMA_VERSION {
        return Err(std::io::Error::other(format!(
            "database schema version {version} is newer than supported version {CURRENT_SCHEMA_VERSION}"
        ))
        .into());
    }

    if version < CURRENT_SCHEMA_VERSION {
        let transaction = connection.unchecked_transaction()?;
        transaction.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                status TEXT NOT NULL DEFAULT 'ACTIVE'
                    CHECK (status IN ('ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED')),
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 500),
                description TEXT,
                status TEXT NOT NULL DEFAULT 'INBOX'
                    CHECK (status IN ('INBOX', 'TODO', 'IN_PROGRESS', 'DONE')),
                priority TEXT NOT NULL DEFAULT 'NONE'
                    CHECK (priority IN ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'URGENT')),
                project_id TEXT,
                due_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                completed_at TEXT,
                archived_at TEXT,
                FOREIGN KEY (project_id) REFERENCES projects(id)
            );

            CREATE INDEX IF NOT EXISTS idx_tasks_inbox
                ON tasks(status, archived_at, created_at DESC);

            PRAGMA user_version = 1;
            "#,
        )?;
        transaction.commit()?;
    }

    Ok(())
}

pub fn create_task(connection: &Connection, title: &str) -> Result<Task> {
    connection.query_row(
        r#"
        INSERT INTO tasks (id, title, status, priority, created_at, updated_at)
        VALUES (
            lower(hex(randomblob(16))),
            ?1,
            'INBOX',
            'NONE',
            strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
            strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        )
        RETURNING id, title, status, priority, created_at, updated_at, completed_at
        "#,
        [title],
        map_task,
    )
}

pub fn list_inbox_tasks(connection: &Connection) -> Result<Vec<Task>> {
    let mut statement = connection.prepare(
        r#"
        SELECT id, title, status, priority, created_at, updated_at, completed_at
        FROM tasks
        WHERE status = 'INBOX' AND archived_at IS NULL
        ORDER BY created_at DESC, rowid DESC
        "#,
    )?;
    let tasks = statement.query_map([], map_task)?;
    tasks.collect()
}

pub fn complete_task(connection: &Connection, id: &str) -> Result<Task> {
    connection.query_row(
        r#"
        UPDATE tasks
        SET status = 'DONE',
            completed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?1 AND status = 'INBOX' AND archived_at IS NULL
        RETURNING id, title, status, priority, created_at, updated_at, completed_at
        "#,
        params![id],
        map_task,
    )
}

fn map_task(row: &rusqlite::Row<'_>) -> Result<Task> {
    Ok(Task {
        id: row.get(0)?,
        title: row.get(1)?,
        status: row.get(2)?,
        priority: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
        completed_at: row.get(6)?,
    })
}

#[cfg(test)]
mod tests {
    use std::{
        path::PathBuf,
        sync::atomic::{AtomicU64, Ordering},
    };

    use rusqlite::Connection;

    use super::{
        complete_task, create_task, initialize_database, list_inbox_tasks, open_connection,
    };

    static NEXT_TEST_DB_ID: AtomicU64 = AtomicU64::new(0);

    fn temporary_database_path() -> PathBuf {
        let id = NEXT_TEST_DB_ID.fetch_add(1, Ordering::Relaxed);
        std::env::temp_dir().join(format!("focusdesk-test-{}-{id}.db", std::process::id()))
    }

    #[test]
    fn migration_is_versioned_and_repeatable() {
        let path = temporary_database_path();

        initialize_database(&path).expect("first migration should succeed");
        initialize_database(&path).expect("migration should be safe to rerun");

        let connection = open_connection(&path).expect("database should open");
        let version: i64 = connection
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .expect("user_version should be readable");
        let foreign_keys: i64 = connection
            .query_row("PRAGMA foreign_keys", [], |row| row.get(0))
            .expect("foreign key setting should be readable");

        assert_eq!(version, 1);
        assert_eq!(foreign_keys, 1);
        drop(connection);
        std::fs::remove_file(path).expect("test database should be cleaned up");
    }

    #[test]
    fn migration_preserves_tasks_from_the_pre_versioned_schema() {
        let path = temporary_database_path();
        {
            let connection = Connection::open(&path).expect("legacy database should be created");
            connection
                .execute_batch(
                    r#"
                    CREATE TABLE tasks (
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
                        archived_at TEXT
                    );

                    INSERT INTO tasks (id, title, created_at, updated_at)
                    VALUES ('legacy-task', 'Keep this task', '2026-10-04T00:00:00.000Z', '2026-10-04T00:00:00.000Z');
                    "#,
                )
                .expect("legacy task should be created");
        }

        initialize_database(&path).expect("migration should upgrade legacy database");

        let connection = open_connection(&path).expect("upgraded database should open");
        let title: String = connection
            .query_row(
                "SELECT title FROM tasks WHERE id = 'legacy-task'",
                [],
                |row| row.get(0),
            )
            .expect("legacy task should remain stored");
        assert_eq!(title, "Keep this task");
        drop(connection);
        std::fs::remove_file(path).expect("test database should be cleaned up");
    }

    #[test]
    fn task_create_complete_and_reload_persist() {
        let path = temporary_database_path();
        initialize_database(&path).expect("migration should succeed");

        let task = {
            let connection = open_connection(&path).expect("database should open");
            create_task(&connection, "Write persistence test").expect("task should be created")
        };

        {
            let connection = open_connection(&path).expect("database should reopen");
            let inbox = list_inbox_tasks(&connection).expect("inbox should load");
            assert_eq!(inbox.as_slice(), std::slice::from_ref(&task));

            let completed = complete_task(&connection, &task.id).expect("task should be completed");
            assert_eq!(completed.status, "DONE");
            assert!(completed.completed_at.is_some());
            assert!(list_inbox_tasks(&connection)
                .expect("inbox should reload")
                .is_empty());
        }

        {
            let connection =
                open_connection(&path).expect("database should reopen after completion");
            let stored_status: String = connection
                .query_row(
                    "SELECT status FROM tasks WHERE id = ?1",
                    [&task.id],
                    |row| row.get(0),
                )
                .expect("completed task should persist");
            assert_eq!(stored_status, "DONE");
        }

        std::fs::remove_file(path).expect("test database should be cleaned up");
    }
}
