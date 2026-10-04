# FocusDesk

FocusDesk is a local-first Windows productivity app built with Tauri 2, React, TypeScript, and SQLite.

## Development

Install dependencies with `pnpm install`, then run the desktop application with:

```powershell
pnpm tauri dev
```

The frontend can also be run in a browser with `pnpm dev`, but database-backed task operations require the Tauri desktop runtime.

## Validation

```powershell
pnpm test
pnpm typecheck
pnpm lint
pnpm build
cargo test --manifest-path src-tauri/Cargo.toml
```

## Data and architecture

The SQLite database is created in Tauri's platform-specific application data directory as `focusdesk.db`. The Rust startup hook applies versioned migrations before the app window is created. Frontend features call application services and repositories; SQLite is accessed only through Tauri commands.

The Inbox supports creating, listing, editing, completing, and archiving tasks. Task priority, status, description, and due date are editable. The All tasks view keeps every unarchived, incomplete task reachable, including tasks without due dates. The Today view groups dated tasks into overdue, due today, scheduled, and completed sections. The Archived view lists archived tasks across app restarts, supports restoring them, and requires explicit confirmation before permanent deletion; permanent deletion is restricted to archived records. Task writes are persisted before the UI is updated; failures are surfaced without presenting an unsaved change as successful.

Projects can be created, edited, archived, and restored. Tasks can be assigned or reassigned to active projects from the task editor, and each project workspace lists its assigned tasks. Archiving a project preserves its tasks and assignments.
