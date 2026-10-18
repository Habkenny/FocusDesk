import { format } from "date-fns";
import { RotateCw, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";

import { TaskRow } from "../tasks/TaskRow";
import { taskService } from "../../services/taskService";
import type { Task, TaskInput } from "../../types/task";

type UndoAction = { id: string; kind: "archive" | "complete"; message: string };
type TaskSection = { title: string; tasks: Task[] };

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function groupTasks(tasks: Task[], today: string): TaskSection[] {
  return [
    {
      title: "Overdue",
      tasks: tasks.filter(
        (task) => task.status !== "DONE" && task.dueAt !== null && task.dueAt < today,
      ),
    },
    {
      title: "Today",
      tasks: tasks.filter((task) => task.status !== "DONE" && task.dueAt === today),
    },
    {
      title: "Scheduled",
      tasks: tasks.filter(
        (task) => task.status !== "DONE" && task.dueAt !== null && task.dueAt > today,
      ),
    },
    { title: "Completed", tasks: tasks.filter((task) => task.status === "DONE") },
  ];
}

export function TodayPage() {
  const today = format(new Date(), "yyyy-MM-dd");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);

  async function loadTasks() {
    setIsLoading(true);
    setError(null);
    try {
      setTasks(await taskService.listToday(today));
    } catch (loadError) {
      setError(
        `Unable to load Today. Your saved data has not been changed. ${messageFromError(loadError)}`,
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;
    taskService
      .listToday(today)
      .then((loadedTasks) => {
        if (isMounted) setTasks(loadedTasks);
      })
      .catch((loadError: unknown) => {
        if (isMounted) {
          setError(
            `Unable to load Today. Your saved data has not been changed. ${messageFromError(loadError)}`,
          );
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [today]);

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
      const completed = await taskService.complete(task.id);
      setTasks((currentTasks) =>
        currentTasks.map((current) => (current.id === task.id ? completed : current)),
      );
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
      setTasks((currentTasks) => [
        restored,
        ...currentTasks.filter(({ id }) => id !== restored.id),
      ]);
      setUndoAction(null);
    } catch (undoError) {
      setError(`Unable to undo this action. ${messageFromError(undoError)}`);
    } finally {
      setPendingTaskId(null);
    }
  }

  const sections = groupTasks(tasks, today);
  const hasTasks = sections.some(({ tasks: sectionTasks }) => sectionTasks.length > 0);

  return (
    <section className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">{format(new Date(), "EEEE, MMMM d")}</p>
          <h2>Today</h2>
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

      {isLoading ? (
        <div className="panel-card loading-state" role="status">
          Loading today’s tasks…
        </div>
      ) : hasTasks ? (
        <div className="today-sections">
          {sections.map((section) => (
            <section
              className="today-section"
              key={section.title}
              aria-labelledby={`today-${section.title}`}
            >
              <header className="today-section-header">
                <h3 id={`today-${section.title}`}>{section.title}</h3>
                <span className="chip">{section.tasks.length}</span>
              </header>
              {section.tasks.length > 0 ? (
                <ul className="task-list" aria-label={`${section.title} tasks`}>
                  {section.tasks.map((task) => (
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
                <p className="today-section-empty">Nothing here.</p>
              )}
            </section>
          ))}
        </div>
      ) : (
        !error && (
          <div className="panel-card empty-state">
            <h3>No scheduled tasks</h3>
            <p className="empty-text">Add due dates to tasks in Inbox and they’ll appear here.</p>
          </div>
        )
      )}
    </section>
  );
}
