import { Navigate, Route, Routes } from "react-router-dom";

import { DashboardPage } from "../../features/dashboard/DashboardPage";
import { InboxPage } from "../../features/inbox/InboxPage";
import { ProjectsPage } from "../../features/projects/ProjectsPage";
import { SettingsPage } from "../../features/settings/SettingsPage";
import { ArchivedPage } from "../../features/tasks/ArchivedPage";
import { AllTasksPage } from "../../features/tasks/AllTasksPage";
import { TodayPage } from "../../features/today/TodayPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/inbox" element={<InboxPage />} />
      <Route path="/today" element={<TodayPage />} />
      <Route path="/tasks" element={<AllTasksPage />} />
      <Route path="/archived" element={<ArchivedPage />} />
      <Route path="/projects" element={<ProjectsPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
