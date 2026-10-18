import { useEffect, useState, type FormEvent } from "react";

import { projectService } from "../../services/projectService";
import type { Project } from "../../types/project";
import type { Task, TaskInput } from "../../types/task";

interface TaskFormProps {
  task?: Task;
  fixedProject?: Project;
  submitLabel: string;
  onSubmit: (input: TaskInput) => Promise<void>;
  onCancel: () => void;
}

export function TaskForm({
  task,
  fixedProject,
  submitLabel,
  onSubmit,
  onCancel,
}: TaskFormProps) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState<TaskInput["status"]>(
    task?.status === "IN_PROGRESS" ? "IN_PROGRESS" : task?.status === "TODO" ? "TODO" : "INBOX",
  );
  const [priority, setPriority] = useState<TaskInput["priority"]>(task?.priority ?? "NONE");
  const [dueAt, setDueAt] = useState(task?.dueAt ?? "");
  const [projectId, setProjectId] = useState(task?.projectId ?? fixedProject?.id ?? "");
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectLoadError, setProjectLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (fixedProject) return;

    let isMounted = true;
    projectService
      .list()
      .then((loadedProjects) => {
        if (isMounted) setProjects(loadedProjects);
      })
      .catch((loadError: unknown) => {
        if (isMounted) {
          setProjectLoadError(
            loadError instanceof Error ? loadError.message : String(loadError),
          );
        }
      });
    return () => {
      isMounted = false;
    };
  }, [fixedProject]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      await onSubmit({
        title,
        description,
        status,
        priority,
        dueAt,
        projectId: fixedProject?.id ?? (projectId || null),
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="panel-card task-form task-editor" onSubmit={handleSubmit}>
      <div className="task-form-grid">
        <label>
          <span className="field-label">Title</span>
          <input
            autoFocus
            maxLength={500}
            required
            value={title}
            onChange={(event) => setTitle(event.currentTarget.value)}
          />
        </label>
        <label>
          <span className="field-label">Due date</span>
          <input
            type="date"
            value={dueAt ?? ""}
            onChange={(event) => setDueAt(event.currentTarget.value)}
          />
        </label>
        <label>
          <span className="field-label">Priority</span>
          <select
            className="select"
            value={priority}
            onChange={(event) => setPriority(event.currentTarget.value as TaskInput["priority"])}
          >
            <option value="NONE">No priority</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </label>
        {fixedProject ? (
          <div>
            <span className="field-label">Project</span>
            <p className="project-description">{fixedProject.name}</p>
          </div>
        ) : (
          <label>
            <span className="field-label">Project</span>
            <select
              className="select"
              value={projectId}
              onChange={(event) => setProjectId(event.currentTarget.value)}
            >
              <option value="">No project</option>
              {projects
                .filter((project) => project.status !== "ARCHIVED" || project.id === projectId)
                .map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}{project.status === "ARCHIVED" ? " (archived)" : ""}
                  </option>
                ))}
            </select>
          </label>
        )}
        {task && (
          <label>
            <span className="field-label">Status</span>
            <select
              className="select"
              value={status}
              onChange={(event) => setStatus(event.currentTarget.value as TaskInput["status"])}
            >
              <option value="INBOX">Inbox</option>
              <option value="TODO">To do</option>
              <option value="IN_PROGRESS">In progress</option>
            </select>
          </label>
        )}
        <label className="task-description-field">
          <span className="field-label">Description</span>
          <textarea
            maxLength={10_000}
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
          />
        </label>
      </div>
      {error && (
        <p className="inline-error" role="alert">
          Could not save task. {error}
        </p>
      )}
      {projectLoadError && (
        <p className="inline-error" role="alert">
          Projects could not be loaded. Task changes can still be saved without changing its
          project. {projectLoadError}
        </p>
      )}
      <div className="task-form-actions">
        <button className="button" type="button" onClick={onCancel} disabled={isSaving}>
          Cancel
        </button>
        <button className="button primary" type="submit" disabled={isSaving}>
          {isSaving ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
