export type TaskStatus = "INBOX" | "TODO" | "IN_PROGRESS" | "DONE";

export type TaskPriority = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type EditableTaskStatus = "INBOX" | "TODO" | "IN_PROGRESS";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  projectId: string | null;
  dueAt: string | null;
  startAt: string | null;
  estimatedDuration: number | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  archivedAt: string | null;
}

export interface TaskInput {
  title: string;
  description: string | null;
  status: EditableTaskStatus;
  priority: TaskPriority;
  dueAt: string | null;
  projectId: string | null;
}
