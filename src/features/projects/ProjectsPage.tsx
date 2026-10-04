export function ProjectsPage() {
  return (
    <section className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Projects</p>
          <h2>Active workstreams</h2>
        </div>
        <button className="button" type="button">
          New project
        </button>
      </header>

      <div className="grid-cards">
        <article className="panel-card">
          <h3>Articulation Coach</h3>
          <p>Product planning and feature execution.</p>
        </article>
        <article className="panel-card">
          <h3>Portfolio</h3>
          <p>Showcase, writing, and proofing.</p>
        </article>
      </div>
    </section>
  );
}
