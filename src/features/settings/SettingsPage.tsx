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
          <p>Choose Light, Dark, or System from the theme selector in the sidebar.</p>
        </div>
        <div>
          <h3>Data</h3>
          <p>Your local SQLite database initializes when the desktop app starts.</p>
        </div>
      </div>
    </section>
  );
}
