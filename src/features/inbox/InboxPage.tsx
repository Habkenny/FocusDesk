import { Check, Plus, RotateCw } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { taskService } from "../../services/taskService";
import type { Task } from "../../types/task";

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function InboxPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
        if (isMounted) {
          setTasks(loadedTasks);
        }
      })
      .catch((loadError: unknown) => {
        if (isMounted) {
          setError(
            `Unable to load your inbox. Your saved data has not been changed. ${messageFromError(loadError)}`,
          );
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);
    setError(null);
    setNotice(null);

    try {
      const task = await taskService.create(title);
      setTasks((currentTasks) => [task, ...currentTasks]);
      setTitle("");
      setIsCreateFormOpen(false);
      setNotice("Task saved to your inbox.");
    } catch (createError) {
      setError(`Unable to save this task. ${messageFromError(createError)}`);
    } finally {
      setIsCreating(false);
    }
  }

  async function handleComplete(task: Task) {
    setPendingTaskId(task.id);
    setError(null);
    setNotice(null);

    try {
      await taskService.complete(task.id);
      setTasks((currentTasks) => currentTasks.filter(({ id }) => id !== task.id));
      setNotice(`Completed “${task.title}”.`);
    } catch (completeError) {
      setError(`Unable to complete “${task.title}”. ${messageFromError(completeError)}`);
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
      {notice && (
        <p className="feedback success-feedback" role="status">
          {notice}
        </p>
      )}

      {isCreateFormOpen && (
        <form className="panel-card task-form" onSubmit={handleCreate}>
          <label className="field-label" htmlFor="new-task-title">
            What needs to be done?
          </label>
          <div className="task-form-row">
            <input
              id="new-task-title"
              autoFocus
              maxLength={500}
              value={title}
              onChange={(event) => setTitle(event.currentTarget.value)}
              placeholder="Add a task to your inbox"
              aria-describedby="task-title-help"
            />
            <button className="button primary" type="submit" disabled={isCreating}>
              {isCreating ? "Saving…" : "Create task"}
            </button>
          </div>
          <span className="helper-text" id="task-title-help">
            Task titles can be up to 500 characters.
          </span>
        </form>
      )}

      {isLoading ? (
        <div className="panel-card loading-state" role="status">
          Loading inbox…
        </div>
      ) : tasks.length > 0 ? (
        <ul className="task-list" aria-label="Inbox tasks">
          {tasks.map((task) => (
            <li className="task-row" key={task.id}>
              <button
                className="task-complete"
                type="button"
                aria-label={`Complete ${task.title}`}
                disabled={pendingTaskId === task.id}
                onClick={() => void handleComplete(task)}
              >
                <Check size={16} aria-hidden="true" />
              </button>
              <span className="task-title">{task.title}</span>
              <span className="task-priority">
                {task.priority === "NONE" ? "No priority" : task.priority}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        !error && (
          <div className="panel-card empty-state">
            <h3>No tasks in your inbox</h3>
            <p className="empty-text">Capture a task here, then decide where it belongs.</p>
            {!isCreateFormOpen && (
              <button className="button" type="button" onClick={() => setIsCreateFormOpen(true)}>
                <Plus size={16} aria-hidden="true" />
                Add your first task
              </button>
            )}
          </div>
        )
      )}
    </section>
  );
}
