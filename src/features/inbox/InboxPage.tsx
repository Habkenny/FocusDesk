export function InboxPage() {
  return (
    <section className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Inbox</p>
          <h2>Unsorted work</h2>
        </div>
        <button className="button primary" type="button">
          New task
        </button>
      </header>

      <div className="panel-card">
        <p className="empty-text">No uncategorized tasks yet.</p>
      </div>
    </section>
  );
}
