import { ArchiveRestore, RotateCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { taskService } from "../../services/taskService";
import type { Task } from "../../types/task";

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function ArchivedPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [confirmTaskId, setConfirmTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setTasks(await taskService.listArchived());
    } catch (loadError) {
      setError(
        `Unable to load archived tasks. Your saved data has not been changed. ${messageFromError(loadError)}`,
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    taskService
      .listArchived()
      .then((loadedTasks) => {
        if (isMounted) setTasks(loadedTasks);
      })
      .catch((loadError: unknown) => {
        if (isMounted) {
          setError(
            `Unable to load archived tasks. Your saved data has not been changed. ${messageFromError(loadError)}`,
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

  async function handleRestore(task: Task) {
    setPendingTaskId(task.id);
    setError(null);
    setNotice(null);
    try {
      await taskService.restore(task.id);
      setTasks((currentTasks) => currentTasks.filter(({ id }) => id !== task.id));
      setNotice(`Restored “${task.title}” to All tasks.`);
    } catch (restoreError) {
      setError(`Unable to restore “${task.title}”. ${messageFromError(restoreError)}`);
    } finally {
      setPendingTaskId(null);
    }
  }

  async function handlePermanentDelete(task: Task) {
    setPendingTaskId(task.id);
    setError(null);
    setNotice(null);
    try {
      await taskService.permanentlyDeleteArchived(task.id);
      setTasks((currentTasks) => currentTasks.filter(({ id }) => id !== task.id));
      setConfirmTaskId(null);
      setNotice(`Permanently deleted “${task.title}”.`);
    } catch (deleteError) {
      setError(`Unable to permanently delete “${task.title}”. ${messageFromError(deleteError)}`);
    } finally {
      setPendingTaskId(null);
    }
  }

  return (
    <section className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Archive</p>
          <h2>Archived tasks</h2>
        </div>
      </header>

      {error && (
        <div className="feedback error-feedback" role="alert">
          <span>{error}</span>
          <button className="button" type="button" onClick={() => void loadTasks()}>
            <RotateCw size={15} aria-hidden="true" />
            Retry
          </button>
        </div>
      )}
      {notice && (
        <p className="feedback success-feedback" role="status">
          {notice}
        </p>
      )}

      {isLoading ? (
        <div className="panel-card loading-state" role="status">
          Loading archived tasks…
        </div>
      ) : tasks.length > 0 ? (
        <ul className="task-list" aria-label="Archived tasks">
          {tasks.map((task) => (
            <li className="task-row archived-task-row" key={task.id}>
              <div className="task-row-content">
                <span className="task-title">{task.title}</span>
                {task.description && <span className="task-description">{task.description}</span>}
              </div>
              <span className="task-status-label">{task.status.replace("_", " ")}</span>
              <button
                className="button"
                type="button"
                disabled={pendingTaskId !== null}
                onClick={() => void handleRestore(task)}
              >
                <ArchiveRestore size={15} aria-hidden="true" />
                Restore
              </button>
              <button
                className="button"
                type="button"
                disabled={pendingTaskId !== null}
                aria-label={`Permanently delete ${task.title}`}
                onClick={() => {
                  setConfirmTaskId(task.id);
                  setError(null);
                  setNotice(null);
                }}
              >
                <Trash2 size={15} aria-hidden="true" />
                Delete
              </button>
              {confirmTaskId === task.id && (
                <div
                  className="archive-delete-confirmation"
                  role="alertdialog"
                  aria-labelledby={`delete-title-${task.id}`}
                >
                  <p id={`delete-title-${task.id}`}>
                    Permanently delete “{task.title}”? This cannot be undone.
                  </p>
                  <button
                    className="button"
                    type="button"
                    disabled={pendingTaskId !== null}
                    onClick={() => setConfirmTaskId(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="button"
                    type="button"
                    disabled={pendingTaskId !== null}
                    onClick={() => void handlePermanentDelete(task)}
                  >
                    {pendingTaskId === task.id ? "Deleting…" : "Confirm permanent deletion"}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        !error && (
          <div className="panel-card empty-state">
            <h3>Archive is empty</h3>
            <p className="empty-text">Archived tasks stay here until you restore or delete them.</p>
          </div>
        )
      )}
    </section>
  );
}