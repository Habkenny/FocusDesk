export function ProjectsPage() {
  return (
    <section className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Projects</p>
          <h2>Active workstreams</h2>
        </div>
      </header>

      <div className="panel-card empty-state">
        <h3>Projects are not set up yet</h3>
        <p className="empty-text">
          Project creation and task grouping will be added after the inbox workflow is complete.
        </p>
      </div>
    </section>
  );
}
