import { type ReactNode } from "react";
import { Archive, CalendarDays, CheckSquare, Home, Inbox, LayoutGrid, Settings } from "lucide-react";
import { NavLink } from "react-router-dom";

import { useThemeStore } from "../../lib/theme-store";

const navigation = [
  { label: "Dashboard", to: "/dashboard", icon: Home },
  { label: "Inbox", to: "/inbox", icon: Inbox },
  { label: "Today", to: "/today", icon: CalendarDays },
  { label: "All tasks", to: "/tasks", icon: CheckSquare },
  { label: "Archived", to: "/archived", icon: Archive },
  { label: "Projects", to: "/projects", icon: LayoutGrid },
  { label: "Settings", to: "/settings", icon: Settings },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">F</div>
          <div>
            <p className="eyebrow">Personal command center</p>
            <h1>FocusDesk</h1>
          </div>
        </div>

        <nav className="nav" aria-label="Main navigation">
          {navigation.map(({ label, to, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
            >
              <Icon size={16} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <label className="field-label" htmlFor="theme-mode">
            Theme
          </label>
          <select
            id="theme-mode"
            className="select"
            value={theme}
            onChange={(event) => setTheme(event.target.value as "light" | "dark" | "system")}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </aside>

      <main className="content-panel">{children}</main>
    </div>
  );
}
