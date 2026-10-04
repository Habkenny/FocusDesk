import { invoke, isTauri } from "@tauri-apps/api/core";

import type { Project, ProjectInput } from "../types/project";
import type { Task } from "../types/task";

function requireDesktopRuntime() {
  if (!isTauri()) {
    throw new Error(
      "Project storage requires the FocusDesk desktop app. Start it with `pnpm tauri dev`.",
    );
  }
}

export const projectRepository = {
  async list(): Promise<Project[]> {
    requireDesktopRuntime();
    return invoke<Project[]>("list_projects");
  },

  async listTasks(id: string): Promise<Task[]> {
    requireDesktopRuntime();
    return invoke<Task[]>("list_project_tasks", { projectId: id });
  },

  async create(input: ProjectInput): Promise<Project> {
    requireDesktopRuntime();
    return invoke<Project>("create_project", { input });
  },

  async update(id: string, input: ProjectInput): Promise<Project> {
    requireDesktopRuntime();
    return invoke<Project>("update_project", { id, input });
  },

  async archive(id: string): Promise<Project> {
    requireDesktopRuntime();
    return invoke<Project>("archive_project", { id });
  },

  async restore(id: string): Promise<Project> {
    requireDesktopRuntime();
    return invoke<Project>("restore_project", { id });
  },
};
