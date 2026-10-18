import { RotateCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { TaskRow } from "./TaskRow";
import { taskService } from "../../services/taskService";
import type { Task, TaskInput } from "../../types/task";

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function AllTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setTasks(await taskService.listActive());
    } catch (loadError) {
      setError(
        `Unable to load active tasks. Your saved data has not been changed. ${messageFromError(loadError)}`,
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    taskService
      .listActive()
      .then((loadedTasks) => {
        if (isMounted) setTasks(loadedTasks);
      })
      .catch((loadError: unknown) => {
        if (isMounted) {
          setError(
            `Unable to load active tasks. Your saved data has not been changed. ${messageFromError(loadError)}`,
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

  async function handleUpdate(task: Task, input: TaskInput) {
    const updated = await taskService.update(task.id, input);
    setTasks((currentTasks) =>
      currentTasks.map((current) => (current.id === updated.id ? updated : current)),
    );
  }

  async function handleComplete(task: Task) {
    setPendingTaskId(task.id);
    setError(null);
    try {
      await taskService.complete(task.id);
      setTasks((currentTasks) => currentTasks.filter(({ id }) => id !== task.id));
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
    } catch (archiveError) {
      setError(`Unable to archive “${task.title}”. ${messageFromError(archiveError)}`);
    } finally {
      setPendingTaskId(null);
    }
  }

  return (
    <section className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Tasks</p>
          <h2>All active tasks</h2>
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

      {isLoading ? (
        <div className="panel-card loading-state" role="status">
          Loading active tasks…
        </div>
      ) : tasks.length > 0 ? (
        <ul className="task-list" aria-label="All active tasks">
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
        !error && (
          <div className="panel-card empty-state">
            <h3>No active tasks</h3>
            <p className="empty-text">Tasks you move out of Inbox remain available here.</p>
          </div>
        )
      )}
    </section>
  );
}