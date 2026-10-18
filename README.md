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
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
```

## Windows release

Releases are built from version-matched tags such as `v1.3.0`. The GitHub Actions release workflow runs the frontend and Rust checks, builds the NSIS installer, signs it, and publishes the installer with a SHA-256 checksum. A Windows code-signing certificate must be configured in the repository Actions secrets before creating a release tag:

- `WINDOWS_SIGNING_PFX_BASE64`: the base64-encoded PKCS#12 code-signing certificate.
- `WINDOWS_SIGNING_PFX_PASSWORD`: its password.

The workflow fails rather than publishing an unsigned installer if either secret is missing or invalid. Never commit certificate files or passwords.

For a local unsigned installer build, run `pnpm tauri build --bundles nsis` after adding Cargo's bin directory to `PATH`. Local unsigned builds are for testing only and can trigger Windows SmartScreen warnings.

## Data and architecture

The SQLite database is created in Tauri's platform-specific application data directory as `focusdesk.db`. The Rust startup hook applies versioned migrations before the app window is created. Frontend features call application services and repositories; SQLite is accessed only through Tauri commands.

### Back up and restore local data

FocusDesk keeps its database on this Windows account; it does not sync data to a server. Before installing an update or moving to another PC, exit FocusDesk and copy `%APPDATA%\com.habke.focusdesk\focusdesk.db` to a safe location. Keep the backup private because it contains your task and project data. To restore it, exit FocusDesk and copy the saved database back to that path, replacing the current database only when you intend to roll back to the backup. Launch FocusDesk to reopen the restored data.

The Inbox supports creating, listing, editing, completing, and archiving tasks. Task priority, status, description, and due date are editable. The All tasks view keeps every unarchived, incomplete task reachable, including tasks without due dates. The Today view groups dated tasks into overdue, due today, scheduled, and completed sections. The Archived view lists archived tasks across app restarts, supports restoring them, and requires explicit confirmation before permanent deletion; permanent deletion is restricted to archived records. Task writes are persisted before the UI is updated; failures are surfaced without presenting an unsaved change as successful.

Projects can be created, edited, archived, and restored. Tasks can be assigned or reassigned to active projects from the task editor, and each project workspace lists its assigned tasks. Archiving a project preserves its tasks and assignments.
