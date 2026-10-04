import { invoke, isTauri } from "@tauri-apps/api/core";

import type { Task, TaskInput } from "../types/task";

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

  async listActive(): Promise<Task[]> {
    requireDesktopRuntime();
    return invoke<Task[]>("list_active_tasks");
  },

  async listArchived(): Promise<Task[]> {
    requireDesktopRuntime();
    return invoke<Task[]>("list_archived_tasks");
  },

  async listToday(today: string): Promise<Task[]> {
    requireDesktopRuntime();
    return invoke<Task[]>("list_today_tasks", { today });
  },

  async create(input: TaskInput): Promise<Task> {
    requireDesktopRuntime();
    return invoke<Task>("create_task", { input });
  },

  async update(id: string, input: TaskInput): Promise<Task> {
    requireDesktopRuntime();
    return invoke<Task>("update_task", { id, input });
  },

  async complete(id: string): Promise<Task> {
    requireDesktopRuntime();
    return invoke<Task>("complete_task", { id });
  },

  async undoCompletion(id: string): Promise<Task> {
    requireDesktopRuntime();
    return invoke<Task>("undo_task_completion", { id });
  },

  async archive(id: string): Promise<Task> {
    requireDesktopRuntime();
    return invoke<Task>("archive_task", { id });
  },

  async restore(id: string): Promise<Task> {
    requireDesktopRuntime();
    return invoke<Task>("restore_task", { id });
  },

  async permanentlyDeleteArchived(id: string): Promise<Task> {
    requireDesktopRuntime();
    return invoke<Task>("permanently_delete_archived_task", { id });
  },
};
