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

The Inbox supports creating, listing, and completing tasks. Task writes are persisted before the UI is updated; failures are shown without presenting an unsaved change as successful.
