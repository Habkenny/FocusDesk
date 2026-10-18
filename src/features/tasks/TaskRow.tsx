import { Archive, Check, Pencil } from "lucide-react";
import { useState } from "react";

import { TaskForm } from "./TaskForm";
import type { Task, TaskInput } from "../../types/task";

interface TaskRowProps {
  task: Task;
  isPending?: boolean;
  onSave: (input: TaskInput) => Promise<void>;
  onComplete: () => void;
  onArchive: () => void;
}

export function TaskRow({ task, isPending = false, onSave, onComplete, onArchive }: TaskRowProps) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <li className="task-row task-row-editing">
        <TaskForm
          key={task.id}
          task={task}
          submitLabel="Save changes"
          onSubmit={async (input) => {
            await onSave(input);
            setIsEditing(false);
          }}
          onCancel={() => setIsEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="task-row">
      {task.status !== "DONE" && (
        <button
          className="task-complete"
          type="button"
          aria-label={`Complete ${task.title}`}
          disabled={isPending}
          onClick={onComplete}
        >
          <Check size={16} aria-hidden="true" />
        </button>
      )}
      <div className="task-row-content">
        <span className={`task-title ${task.status === "DONE" ? "task-title-done" : ""}`}>
          {task.title}
        </span>
        {task.description && <span className="task-description">{task.description}</span>}
      </div>
      <span className={`priority-label priority-${task.priority.toLowerCase()}`}>
        {task.priority === "NONE" ? "No priority" : task.priority}
      </span>
      {task.dueAt && (
        <time className="task-date" dateTime={task.dueAt}>
          {task.dueAt}
        </time>
      )}
      <span className="task-status-label">{task.status.replace("_", " ")}</span>
      {task.status !== "DONE" && (
        <button
          className="icon-button"
          type="button"
          aria-label={`Edit ${task.title}`}
          disabled={isPending}
          onClick={() => setIsEditing(true)}
        >
          <Pencil size={15} aria-hidden="true" />
        </button>
      )}
      <button
        className="icon-button"
        type="button"
        aria-label={`Archive ${task.title}`}
        disabled={isPending}
        onClick={onArchive}
      >
        <Archive size={15} aria-hidden="true" />
      </button>
    </li>
  );
}
