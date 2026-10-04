import { invoke, isTauri } from "@tauri-apps/api/core";

import type { Task } from "../types/task";

function requireDesktopRuntime() {
  if (!isTauri()) {
    throw new Error(
      "Task storage requires the FocusDesk desktop app. Start it with `pnpm tauri dev`.",
    );
  }
}

export const taskRepository = {
  async listInbox(): Promise<Task[]> {
    requireDesktopRuntime();
    return invoke<Task[]>("list_inbox_tasks");
  },

  async create(title: string): Promise<Task> {
    requireDesktopRuntime();
    return invoke<Task>("create_task", { title });
  },

  async complete(id: string): Promise<Task> {
    requireDesktopRuntime();
    return invoke<Task>("complete_task", { id });
  },
};
