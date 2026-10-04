export function DashboardPage() {
  return (
    <section className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Good morning.</p>
          <h2>Here’s what matters today.</h2>
        </div>
        <span className="chip">October 4, 2026</span>
      </header>

      <div className="stats-grid">
        <article className="stat-card">
          <span>Tasks completed</span>
          <strong>8</strong>
        </article>
        <article className="stat-card">
          <span>Focus time</span>
          <strong>2h 45m</strong>
        </article>
        <article className="stat-card">
          <span>Overdue</span>
          <strong>1</strong>
        </article>
        <article className="stat-card">
          <span>Current streak</span>
          <strong>5 days</strong>
        </article>
      </div>

      <div className="stack-grid">
        <article className="panel-card">
          <h3>Priority tasks</h3>
          <ul className="list">
            <li>Ship the portfolio summary</li>
            <li>Review FocusDesk sprint plan</li>
            <li>Finalize Q4 roadmap notes</li>
          </ul>
        </article>

        <article className="panel-card">
          <h3>Today’s schedule</h3>
          <ul className="list">
            <li>09:00 — Daily planning</li>
            <li>11:30 — Design review</li>
            <li>15:00 — Focus sprint</li>
          </ul>
        </article>
      </div>
    </section>
  );
}
