use std::path::Path;

use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

const CURRENT_SCHEMA_VERSION: i64 = 3;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskInput {
    pub title: String,
    pub description: Option<String>,
    pub priority: String,
    pub due_at: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub priority: String,
    pub due_at: Option<String>,
    pub start_at: Option<String>,
    pub estimated_duration: Option<i64>,
    pub position: i64,
    pub created_at: String,
    pub updated_at: String,
    pub completed_at: Option<String>,
    pub archived_at: Option<String>,
}

pub fn open_connection(db_path: &Path) -> Result<Connection> {
    let connection = Connection::open(db_path)?;
    connection.execute_batch("PRAGMA foreign_keys = ON;")?;
    Ok(connection)
}

pub fn initialize_database(db_path: &Path) -> std::result::Result<(), Box<dyn std::error::Error>> {
    let connection = open_connection(db_path)?;
    let mut version: i64 = connection.query_row("PRAGMA user_version", [], |row| row.get(0))?;

    if version > CURRENT_SCHEMA_VERSION {
        return Err(std::io::Error::other(format!(
            "database schema version {version} is newer than supported version {CURRENT_SCHEMA_VERSION}"
        ))
        .into());
    }

    if version < 1 {
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
        version = 1;
    }

    if version < 2 {
        let transaction = connection.unchecked_transaction()?;
        transaction.execute_batch(
            r#"
            ALTER TABLE tasks ADD COLUMN start_at TEXT;
            ALTER TABLE tasks ADD COLUMN estimated_duration INTEGER;
            ALTER TABLE tasks ADD COLUMN actual_duration INTEGER;
            ALTER TABLE tasks ADD COLUMN recurrence_rule TEXT;
            ALTER TABLE tasks ADD COLUMN position INTEGER NOT NULL DEFAULT 0;

            CREATE INDEX IF NOT EXISTS idx_tasks_due
                ON tasks(due_at, status, archived_at);

            PRAGMA user_version = 2;
            "#,
        )?;
        transaction.commit()?;
        version = 2;
    }

    if version < 3 {
        let transaction = connection.unchecked_transaction()?;
        transaction.execute_batch(
            r#"
            ALTER TABLE tasks ADD COLUMN previous_status TEXT;
            PRAGMA user_version = 3;
            "#,
        )?;
        transaction.commit()?;
    }

    Ok(())
}

const TASK_COLUMNS: &str = "id, title, description, status, priority, due_at, start_at, estimated_duration, position, created_at, updated_at, completed_at, archived_at";

pub fn create_task(connection: &Connection, input: &TaskInput) -> Result<Task> {
    let status = input.status.as_deref().unwrap_or("INBOX");
    connection.query_row(
        r#"
        INSERT INTO tasks (id, title, description, status, priority, due_at, created_at, updated_at)
        VALUES (
            lower(hex(randomblob(16))),
            ?1, ?2, ?3, ?4, ?5,
            strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
            strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        )
        RETURNING id, title, description, status, priority, due_at, start_at,
                  estimated_duration, position, created_at, updated_at, completed_at, archived_at
        "#,
        params![
            input.title,
            input.description,
            status,
            input.priority,
            input.due_at
        ],
        map_task,
    )
}

pub fn update_task(connection: &Connection, id: &str, input: &TaskInput) -> Result<Task> {
    let status = input.status.as_deref().unwrap_or("INBOX");
    connection.query_row(
        r#"
        UPDATE tasks
        SET title = ?2,
            description = ?3,
            status = ?4,
            priority = ?5,
            due_at = ?6,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?1 AND archived_at IS NULL AND status != 'DONE'
        RETURNING id, title, description, status, priority, due_at, start_at,
                  estimated_duration, position, created_at, updated_at, completed_at, archived_at
        "#,
        params![
            id,
            input.title,
            input.description,
            status,
            input.priority,
            input.due_at
        ],
        map_task,
    )
}

pub fn list_inbox_tasks(connection: &Connection) -> Result<Vec<Task>> {
    let mut statement = connection.prepare(&format!(
        "SELECT {TASK_COLUMNS} FROM tasks WHERE status = 'INBOX' AND archived_at IS NULL ORDER BY created_at DESC, rowid DESC"
    ))?;
    let tasks = statement.query_map([], map_task)?;
    tasks.collect()
}

pub fn list_today_tasks(connection: &Connection, today: &str) -> Result<Vec<Task>> {
    let mut statement = connection.prepare(&format!(
        r#"
        SELECT {TASK_COLUMNS}
        FROM tasks
        WHERE archived_at IS NULL
          AND (
            (status != 'DONE' AND due_at IS NOT NULL)
            OR (status = 'DONE' AND date(completed_at, 'localtime') = ?1)
          )
        ORDER BY
            CASE WHEN status = 'DONE' THEN 1 ELSE 0 END,
            due_at ASC,
            created_at DESC
        "#
    ))?;
    let tasks = statement.query_map([today], map_task)?;
    tasks.collect()
}

pub fn complete_task(connection: &Connection, id: &str) -> Result<Task> {
    connection.query_row(
        r#"
        UPDATE tasks
        SET previous_status = status,
            status = 'DONE',
            completed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?1 AND status != 'DONE' AND archived_at IS NULL
        RETURNING id, title, description, status, priority, due_at, start_at,
                  estimated_duration, position, created_at, updated_at, completed_at, archived_at
        "#,
        params![id],
        map_task,
    )
}

pub fn undo_completion(connection: &Connection, id: &str) -> Result<Task> {
    connection.query_row(
        r#"
        UPDATE tasks
        SET status = COALESCE(previous_status, 'INBOX'),
            previous_status = NULL,
            completed_at = NULL,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?1 AND status = 'DONE' AND archived_at IS NULL
        RETURNING id, title, description, status, priority, due_at, start_at,
                  estimated_duration, position, created_at, updated_at, completed_at, archived_at
        "#,
        params![id],
        map_task,
    )
}

pub fn archive_task(connection: &Connection, id: &str) -> Result<Task> {
    connection.query_row(
        r#"
        UPDATE tasks
        SET archived_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?1 AND archived_at IS NULL
        RETURNING id, title, description, status, priority, due_at, start_at,
                  estimated_duration, position, created_at, updated_at, completed_at, archived_at
        "#,
        params![id],
        map_task,
    )
}

pub fn restore_task(connection: &Connection, id: &str) -> Result<Task> {
    connection.query_row(
        r#"
        UPDATE tasks
        SET archived_at = NULL,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?1 AND archived_at IS NOT NULL
        RETURNING id, title, description, status, priority, due_at, start_at,
                  estimated_duration, position, created_at, updated_at, completed_at, archived_at
        "#,
        params![id],
        map_task,
    )
}

fn map_task(row: &rusqlite::Row<'_>) -> Result<Task> {
    Ok(Task {
        id: row.get(0)?,
        title: row.get(1)?,
        description: row.get(2)?,
        status: row.get(3)?,
        priority: row.get(4)?,
        due_at: row.get(5)?,
        start_at: row.get(6)?,
        estimated_duration: row.get(7)?,
        position: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
        completed_at: row.get(11)?,
        archived_at: row.get(12)?,
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
        archive_task, complete_task, create_task, initialize_database, list_inbox_tasks,
        list_today_tasks, open_connection, restore_task, undo_completion, update_task, TaskInput,
    };

    static NEXT_TEST_DB_ID: AtomicU64 = AtomicU64::new(0);

    fn temporary_database_path() -> PathBuf {
        let id = NEXT_TEST_DB_ID.fetch_add(1, Ordering::Relaxed);
        std::env::temp_dir().join(format!("focusdesk-test-{}-{id}.db", std::process::id()))
    }

    fn task_input(title: &str) -> TaskInput {
        TaskInput {
            title: title.to_string(),
            description: None,
            priority: "NONE".to_string(),
            due_at: None,
            status: None,
        }
    }

    #[test]
    fn migrations_are_versioned_and_repeatable() {
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

        assert_eq!(version, 3);
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
    fn migration_upgrades_version_one_database_without_losing_tasks() {
        let path = temporary_database_path();
        {
            let connection =
                Connection::open(&path).expect("version one database should be created");
            connection
                .execute_batch(
                    r#"
                    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
                    CREATE TABLE projects (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        description TEXT,
                        status TEXT NOT NULL DEFAULT 'ACTIVE',
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL
                    );
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
                        archived_at TEXT,
                        FOREIGN KEY (project_id) REFERENCES projects(id)
                    );
                    INSERT INTO tasks (id, title, status, priority, created_at, updated_at)
                    VALUES ('version-one-task', 'Retain this task', 'TODO', 'HIGH', '2026-10-04T00:00:00.000Z', '2026-10-04T00:00:00.000Z');
                    PRAGMA user_version = 1;
                    "#,
                )
                .expect("version one task should be created");
        }

        initialize_database(&path).expect("version one database should upgrade");

        let connection = open_connection(&path).expect("upgraded database should open");
        let task: (String, String, String) = connection
            .query_row(
                "SELECT title, status, priority FROM tasks WHERE id = 'version-one-task'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .expect("version one task should still exist");
        let version: i64 = connection
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .expect("schema version should be readable");

        assert_eq!(
            task,
            (
                "Retain this task".to_string(),
                "TODO".to_string(),
                "HIGH".to_string()
            )
        );
        assert_eq!(version, 3);
        drop(connection);
        std::fs::remove_file(path).expect("test database should be cleaned up");
    }

    #[test]
    fn task_crud_archive_and_undo_persist() {
        let path = temporary_database_path();
        initialize_database(&path).expect("migration should succeed");

        let connection = open_connection(&path).expect("database should open");
        let task =
            create_task(&connection, &task_input("Initial title")).expect("task should create");
        let updated = update_task(
            &connection,
            &task.id,
            &TaskInput {
                title: "Updated title".to_string(),
                description: Some("Task details".to_string()),
                priority: "HIGH".to_string(),
                due_at: Some("2026-10-04".to_string()),
                status: Some("TODO".to_string()),
            },
        )
        .expect("task should update");
        assert_eq!(updated.title, "Updated title");
        assert_eq!(updated.description.as_deref(), Some("Task details"));
        assert_eq!(updated.priority, "HIGH");
        assert_eq!(updated.due_at.as_deref(), Some("2026-10-04"));
        assert_eq!(updated.status, "TODO");

        let completed = complete_task(&connection, &task.id).expect("task should complete");
        assert_eq!(completed.status, "DONE");
        let reopened = undo_completion(&connection, &task.id).expect("completion should undo");
        assert_eq!(reopened.status, "TODO");
        assert_eq!(reopened.completed_at, None);

        let archived = archive_task(&connection, &task.id).expect("task should archive");
        assert!(archived.archived_at.is_some());
        assert!(list_inbox_tasks(&connection)
            .expect("inbox should list")
            .is_empty());

        let restored = restore_task(&connection, &task.id).expect("archive should undo");
        assert_eq!(restored.title, "Updated title");
        assert_eq!(restored.archived_at, None);
        assert_eq!(
            list_inbox_tasks(&connection)
                .expect("inbox should reload")
                .len(),
            0
        );
        assert_eq!(restored.status, "TODO");
        drop(connection);
        std::fs::remove_file(path).expect("test database should be cleaned up");
    }

    #[test]
    fn today_query_groups_due_and_completed_tasks_by_day() {
        let path = temporary_database_path();
        initialize_database(&path).expect("migration should succeed");
        let connection = open_connection(&path).expect("database should open");

        let today = local_today(&connection);
        let today_task = create_task(
            &connection,
            &TaskInput {
                title: "Due today".to_string(),
                description: None,
                priority: "NONE".to_string(),
                due_at: Some(today.clone()),
                status: None,
            },
        )
        .expect("today task should create");
        let future_day: String = connection
            .query_row("SELECT date(?1, '+1 day')", [&today], |row| row.get(0))
            .expect("future test date should be calculated");
        let future_task = create_task(
            &connection,
            &TaskInput {
                title: "Scheduled later".to_string(),
                description: None,
                priority: "NONE".to_string(),
                due_at: Some(future_day),
                status: None,
            },
        )
        .expect("future task should create");
        let undated = create_task(&connection, &task_input("Unscheduled inbox task"))
            .expect("undated task should create");
        let completed =
            complete_task(&connection, &today_task.id).expect("today task should complete");

        let today_tasks = list_today_tasks(&connection, &today).expect("today should load");
        let today_ids = today_tasks
            .iter()
            .map(|task| task.id.as_str())
            .collect::<Vec<_>>();
        assert!(today_ids.contains(&future_task.id.as_str()));
        assert!(today_ids.contains(&completed.id.as_str()));
        assert!(!today_ids.contains(&undated.id.as_str()));

        drop(connection);
        std::fs::remove_file(path).expect("test database should be cleaned up");
    }

    fn local_today(connection: &Connection) -> String {
        connection
            .query_row("SELECT date('now', 'localtime')", [], |row| row.get(0))
            .expect("local test day should be available")
    }
}
