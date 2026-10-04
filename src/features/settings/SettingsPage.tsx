export function SettingsPage() {
  return (
    <section className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Settings</p>
          <h2>Application preferences</h2>
        </div>
      </header>

      <div className="panel-card settings-grid">
        <div>
          <h3>Appearance</h3>
          <label className="field-label">Theme</label>
          <div className="chip-row">
            <span className="chip">Light</span>
            <span className="chip">Dark</span>
            <span className="chip">System</span>
          </div>
        </div>
        <div>
          <h3>Data</h3>
          <p>SQLite database is active and ready for local-first workflows.</p>
        </div>
      </div>
    </section>
  );
}
