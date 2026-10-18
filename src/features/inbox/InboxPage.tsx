import { Plus, RotateCw, Undo2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { TaskForm } from "../tasks/TaskForm";
import { TaskRow } from "../tasks/TaskRow";
import { taskService } from "../../services/taskService";
import type { Task, TaskInput } from "../../types/task";

type UndoAction = { id: string; kind: "archive" | "complete"; message: string };

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function InboxPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setTasks(await taskService.listInbox());
    } catch (loadError) {
      setError(
        `Unable to load your inbox. Your saved data has not been changed. ${messageFromError(loadError)}`,
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    taskService
      .listInbox()
      .then((loadedTasks) => {
        if (isMounted) setTasks(loadedTasks);
      })
      .catch((loadError: unknown) => {
        if (isMounted) {
          setError(
            `Unable to load your inbox. Your saved data has not been changed. ${messageFromError(loadError)}`,
          );
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleCreate(input: TaskInput) {
    setError(null);
    const task = await taskService.create(input);
    if (task.status === "INBOX") {
      setTasks((currentTasks) => [task, ...currentTasks]);
    }
    setNotice("Task saved to your inbox.");
    setIsCreateFormOpen(false);
  }

  async function handleUpdate(task: Task, input: TaskInput) {
    const updated = await taskService.update(task.id, input);
    if (updated.status === "INBOX") {
      setTasks((currentTasks) =>
        currentTasks.map((currentTask) => (currentTask.id === updated.id ? updated : currentTask)),
      );
    } else {
      setTasks((currentTasks) => currentTasks.filter(({ id }) => id !== updated.id));
    }
    setNotice("Task changes saved.");
  }

  async function handleComplete(task: Task) {
    setPendingTaskId(task.id);
    setError(null);
    try {
      await taskService.complete(task.id);
      setTasks((currentTasks) => currentTasks.filter(({ id }) => id !== task.id));
      setNotice(null);
      setUndoAction({ id: task.id, kind: "complete", message: `Completed “${task.title}”.` });
    } catch (completeError) {
      setError(`Unable to complete “${task.title}”. ${messageFromError(completeError)}`);
    } finally {
      setPendingTaskId(null);
    }
  }

  async function handleArchive(task: Task) {
    setPendingTaskId(task.id);
    setError(null);
    try {
      await taskService.archive(task.id);
      setTasks((currentTasks) => currentTasks.filter(({ id }) => id !== task.id));
      setNotice(null);
      setUndoAction({ id: task.id, kind: "archive", message: `Archived “${task.title}”.` });
    } catch (archiveError) {
      setError(`Unable to archive “${task.title}”. ${messageFromError(archiveError)}`);
    } finally {
      setPendingTaskId(null);
    }
  }

  async function handleUndo() {
    if (!undoAction) return;

    setPendingTaskId(undoAction.id);
    setError(null);
    try {
      const restored =
        undoAction.kind === "archive"
          ? await taskService.restore(undoAction.id)
          : await taskService.undoCompletion(undoAction.id);
      if (restored.status === "INBOX") {
        setTasks((currentTasks) => [restored, ...currentTasks]);
      }
      setUndoAction(null);
      setNotice("Action undone.");
    } catch (undoError) {
      setError(`Unable to undo this action. ${messageFromError(undoError)}`);
    } finally {
      setPendingTaskId(null);
    }
  }

  return (
    <section className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Inbox</p>
          <h2>Unsorted work</h2>
        </div>
        <button
          className="button primary"
          type="button"
          onClick={() => {
            setIsCreateFormOpen((isOpen) => !isOpen);
            setError(null);
            setNotice(null);
          }}
        >
          <Plus size={16} aria-hidden="true" />
          New task
        </button>
      </header>

      {error && (
        <div className="feedback error-feedback" role="alert">
          <span>{error}</span>
          {!isCreateFormOpen && (
            <button className="button" type="button" onClick={() => void loadTasks()}>
              <RotateCw size={15} aria-hidden="true" />
              Retry
            </button>
          )}
        </div>
      )}
      {undoAction && (
        <p className="feedback success-feedback" role="status">
          <span>{undoAction.message}</span>
          <button
            className="button"
            type="button"
            onClick={() => void handleUndo()}
            disabled={pendingTaskId !== null}
          >
            <Undo2 size={15} aria-hidden="true" />
            Undo
          </button>
        </p>
      )}
      {notice && !undoAction && (
        <p className="feedback success-feedback" role="status">
          {notice}
        </p>
      )}

      {isCreateFormOpen && (
        <TaskForm
          submitLabel="Create task"
          onSubmit={handleCreate}
          onCancel={() => setIsCreateFormOpen(false)}
        />
      )}

      {isLoading ? (
        <div className="panel-card loading-state" role="status">
          Loading inbox…
        </div>
      ) : tasks.length > 0 ? (
        <ul className="task-list" aria-label="Inbox tasks">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              isPending={pendingTaskId === task.id}
              onSave={(input) => handleUpdate(task, input)}
              onComplete={() => void handleComplete(task)}
              onArchive={() => void handleArchive(task)}
            />
          ))}
        </ul>
      ) : (
        !error &&
        !isCreateFormOpen && (
          <div className="panel-card empty-state">
            <h3>No tasks in your inbox</h3>
            <p className="empty-text">Capture a task here, then decide where it belongs.</p>
            <button className="button" type="button" onClick={() => setIsCreateFormOpen(true)}>
              <Plus size={16} aria-hidden="true" />
              Add your first task
            </button>
          </div>
        )
      )}
    </section>
  );
}
