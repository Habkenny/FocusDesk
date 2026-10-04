import { isValid, parseISO } from "date-fns";
import { z } from "zod";

import { taskRepository } from "../repositories/taskRepository";
import type { TaskInput } from "../types/task";

const taskInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Enter a task title.")
    .max(500, "Task titles must be 500 characters or fewer."),
  description: z.string().max(10_000, "Task descriptions must be 10,000 characters or fewer."),
  status: z.enum(["INBOX", "TODO", "IN_PROGRESS"]),
  priority: z.enum(["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"]),
  dueAt: z
    .string()
    .refine(
      (date) => date === "" || (isValid(parseISO(date)) && /^\d{4}-\d{2}-\d{2}$/.test(date)),
      "Choose a valid due date.",
    ),
});

function validateInput(input: TaskInput): TaskInput {
  const validation = taskInputSchema.safeParse({
    ...input,
    description: input.description ?? "",
    dueAt: input.dueAt ?? "",
  });
  if (!validation.success) {
    throw new Error(validation.error.issues[0]?.message ?? "Check the task details and try again.");
  }

  return {
    ...validation.data,
    description: validation.data.description.trim() || null,
    dueAt: validation.data.dueAt || null,
  };
}

export const taskService = {
  listInbox() {
    return taskRepository.listInbox();
  },

  listToday(today: string) {
    return taskRepository.listToday(today);
  },

  create(input: TaskInput) {
    return taskRepository.create(validateInput(input));
  },

  update(id: string, input: TaskInput) {
    return taskRepository.update(id, validateInput(input));
  },

  complete(id: string) {
    return taskRepository.complete(id);
  },

  undoCompletion(id: string) {
    return taskRepository.undoCompletion(id);
  },

  archive(id: string) {
    return taskRepository.archive(id);
  },

  restore(id: string) {
    return taskRepository.restore(id);
  },
};
