import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export function DashboardPage() {
  return (
    <section className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">FocusDesk</p>
          <h2>What matters today?</h2>
        </div>
      </header>

      <div className="panel-card dashboard-intro">
        <div>
          <h3>Your workspace is ready.</h3>
          <p className="empty-text">
            Add work to your inbox to start planning. Dashboard summaries will appear when they can
            reflect your saved data.
          </p>
        </div>
        <Link className="button primary" to="/inbox">
          Go to Inbox
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
