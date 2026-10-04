import { z } from "zod";

import { taskRepository } from "../repositories/taskRepository";

const taskTitleSchema = z
  .string()
  .trim()
  .min(1, "Enter a task title.")
  .max(500, "Task titles must be 500 characters or fewer.");

export const taskService = {
  listInbox() {
    return taskRepository.listInbox();
  },

  create(title: string) {
    const validation = taskTitleSchema.safeParse(title);
    if (!validation.success) {
      throw new Error(validation.error.issues[0]?.message ?? "Enter a task title.");
    }
    return taskRepository.create(validation.data);
  },

  complete(id: string) {
    return taskRepository.complete(id);
  },
};
