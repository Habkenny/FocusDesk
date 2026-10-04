import { Archive, ArchiveRestore, Pencil, Plus, RotateCw, Undo2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { projectService } from "../../services/projectService";
import { taskService } from "../../services/taskService";
import type { Project, ProjectInput } from "../../types/project";
import type { Task, TaskInput } from "../../types/task";
import { ProjectForm } from "./ProjectForm";
import { TaskRow } from "../tasks/TaskRow";
import { TaskForm } from "../tasks/TaskForm";

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [areTasksLoading, setAreTasksLoading] = useState(false);
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [isCreateTaskFormOpen, setIsCreateTaskFormOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [completedTaskUndo, setCompletedTaskUndo] = useState<{ id: string; title: string } | null>(
    null,
  );
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const loadedProjects = await projectService.list();
      setProjects(loadedProjects);
      const initialProjectId =
        loadedProjects.find((project) => project.status !== "ARCHIVED")?.id ?? null;
      setSelectedProjectId(initialProjectId);
      setAreTasksLoading(initialProjectId !== null);
    } catch (loadError) {
      setError(
        `Unable to load projects. Your saved data has not been changed. ${messageFromError(loadError)}`,
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadProjectTasks = useCallback(async (projectId: string) => {
    setAreTasksLoading(true);
    setError(null);
    try {
      setTasks(await projectService.listTasks(projectId));
    } catch (loadError) {
      setError(
        `Unable to load project tasks. Your saved data has not been changed. ${messageFromError(loadError)}`,
      );
    } finally {
      setAreTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    projectService
      .list()
      .then((loadedProjects) => {
        if (isMounted) {
          setProjects(loadedProjects);
          const initialProjectId =
            loadedProjects.find((project) => project.status !== "ARCHIVED")?.id ?? null;
          setSelectedProjectId(initialProjectId);
          setAreTasksLoading(initialProjectId !== null);
        }
      })
      .catch((loadError: unknown) => {
        if (isMounted) {
          setError(
            `Unable to load projects. Your saved data has not been changed. ${messageFromError(loadError)}`,
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

  useEffect(() => {
    if (!selectedProjectId) return;

    let isMounted = true;
    void projectService
      .listTasks(selectedProjectId)
      .then((loadedTasks) => {
        if (isMounted) setTasks(loadedTasks);
      })
      .catch((loadError: unknown) => {
        if (isMounted) {
          setError(
            `Unable to load project tasks. Your saved data has not been changed. ${messageFromError(loadError)}`,
          );
        }
      })
      .finally(() => {
        if (isMounted) setAreTasksLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedProjectId]);

  async function handleCreate(input: ProjectInput) {
    setError(null);
    const project = await projectService.create(input);
    setProjects((currentProjects) => [...currentProjects, project]);
    setTasks([]);
    setAreTasksLoading(true);
    setSelectedProjectId(project.id);
    setIsCreateFormOpen(false);
    setNotice(`Created project “${project.name}”.`);
  }

  async function handleUpdate(project: Project, input: ProjectInput) {
    setError(null);
    const updated = await projectService.update(project.id, input);
    setProjects((currentProjects) =>
      currentProjects.map((current) => (current.id === updated.id ? updated : current)),
    );
    setEditingProjectId(null);
    setNotice(`Updated project “${updated.name}”.`);
  }

  async function handleArchive(project: Project) {
    setPendingId(project.id);
    setError(null);
    try {
      const archived = await projectService.archive(project.id);
      setProjects((currentProjects) =>
        currentProjects.map((current) => (current.id === archived.id ? archived : current)),
      );
      if (selectedProjectId === project.id) {
        setSelectedProjectId(null);
        setTasks([]);
        setAreTasksLoading(false);
        setCompletedTaskUndo(null);
      }
      setNotice(`Archived project “${project.name}”. Its tasks are preserved.`);
    } catch (archiveError) {
      setError(`Unable to archive “${project.name}”. ${messageFromError(archiveError)}`);
    } finally {
      setPendingId(null);
    }
  }

  async function handleRestore(project: Project) {
    setPendingId(project.id);
    setError(null);
    try {
      const restored = await projectService.restore(project.id);
      setProjects((currentProjects) =>
        currentProjects.map((current) => (current.id === restored.id ? restored : current)),
      );
      setTasks([]);
      setAreTasksLoading(true);
      setSelectedProjectId(restored.id);
      setNotice(`Restored project “${project.name}”. Its task assignments are unchanged.`);
    } catch (restoreError) {
      setError(`Unable to restore “${project.name}”. ${messageFromError(restoreError)}`);
    } finally {
      setPendingId(null);
    }
  }

  async function handleTaskUpdate(task: Task, input: TaskInput) {
    const updated = await taskService.update(task.id, input);
    setTasks((currentTasks) => {
      if (updated.projectId !== selectedProjectId) {
        return currentTasks.filter(({ id }) => id !== updated.id);
      }
      return currentTasks.map((current) => (current.id === updated.id ? updated : current));
    });
  }

  async function handleCreateTask(input: TaskInput) {
    if (!selectedProject) return;
    setError(null);
    const created = await taskService.create({ ...input, projectId: selectedProject.id });
    setTasks((currentTasks) => [created, ...currentTasks]);
    setIsCreateTaskFormOpen(false);
    setNotice(`Created task in “${selectedProject.name}”.`);
  }

  async function handleTaskComplete(task: Task) {
    setPendingId(task.id);
    setError(null);
    try {
      const completed = await taskService.complete(task.id);
      setTasks((currentTasks) =>
        currentTasks.map((current) =>
          current.id === task.id
            ? completed
            : current,
        ),
      );
      setCompletedTaskUndo({ id: task.id, title: task.title });
      setNotice(null);
    } catch (completeError) {
      setError(`Unable to complete “${task.title}”. ${messageFromError(completeError)}`);
    } finally {
      setPendingId(null);
    }
  }

  async function handleUndoTaskCompletion() {
    if (!completedTaskUndo) return;
    setPendingId(completedTaskUndo.id);
    setError(null);
    try {
      const restored = await taskService.undoCompletion(completedTaskUndo.id);
      setTasks((currentTasks) =>
        currentTasks.map((current) => (current.id === restored.id ? restored : current)),
      );
      setNotice(`Completion undone for “${restored.title}”.`);
      setCompletedTaskUndo(null);
    } catch (undoError) {
      setError(
        `Unable to undo completion for “${completedTaskUndo.title}”. ${messageFromError(undoError)}`,
      );
    } finally {
      setPendingId(null);
    }
  }

  async function handleTaskArchive(task: Task) {
    setPendingId(task.id);
    setError(null);
    try {
      await taskService.archive(task.id);
      setTasks((currentTasks) => currentTasks.filter(({ id }) => id !== task.id));
      if (completedTaskUndo?.id === task.id) setCompletedTaskUndo(null);
    } catch (archiveError) {
      setError(`Unable to archive “${task.title}”. ${messageFromError(archiveError)}`);
    } finally {
      setPendingId(null);
    }
  }

  const activeProjects = projects.filter((project) => project.status !== "ARCHIVED");
  const archivedProjects = projects.filter((project) => project.status === "ARCHIVED");
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;

  return (
    <section className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Projects</p>
          <h2>Project workspaces</h2>
        </div>
        <button
          className="button primary"
          type="button"
          onClick={() => {
            setIsCreateFormOpen((open) => !open);
            setEditingProjectId(null);
            setError(null);
          }}
        >
          <Plus size={16} aria-hidden="true" />
          New project
        </button>
      </header>

      {error && (
        <div className="feedback error-feedback" role="alert">
          <span>{error}</span>
          <button
            className="button"
            type="button"
            onClick={() => {
              void loadProjects();
              if (selectedProjectId) void loadProjectTasks(selectedProjectId);
            }}
          >
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

      {isCreateFormOpen && (
        <ProjectForm
          submitLabel="Create project"
          onSubmit={handleCreate}
          onCancel={() => setIsCreateFormOpen(false)}
        />
      )}

      {isLoading ? (
        <div className="panel-card loading-state" role="status">
          Loading projects…
        </div>
      ) : (
        <div className="project-layout">
          <div className="project-list-panel">
            {activeProjects.length > 0 ? (
              <ul className="project-list" aria-label="Active projects">
                {activeProjects.map((project) => (
                  <li
                    className={`project-card ${selectedProjectId === project.id ? "selected" : ""}`}
                    key={project.id}
                  >
                    {editingProjectId === project.id ? (
                      <ProjectForm
                        project={project}
                        submitLabel="Save project"
                        onSubmit={(input) => handleUpdate(project, input)}
                        onCancel={() => setEditingProjectId(null)}
                      />
                    ) : (
                      <>
                        <button
                          className="project-select"
                          type="button"
                          aria-pressed={selectedProjectId === project.id}
                          onClick={() => {
                            setTasks([]);
                            setCompletedTaskUndo(null);
                            setAreTasksLoading(true);
                            setSelectedProjectId(project.id);
                          }}
                        >
                          <span className="project-name">{project.name}</span>
                          {project.description && (
                            <span className="project-description">{project.description}</span>
                          )}
                          <span className="chip">{project.status.replace("_", " ")}</span>
                        </button>
                        <div className="project-actions">
                          <button
                            className="icon-button"
                            type="button"
                            aria-label={`Edit ${project.name}`}
                            disabled={pendingId !== null}
                            onClick={() => {
                              setEditingProjectId(project.id);
                              setIsCreateFormOpen(false);
                            }}
                          >
                            <Pencil size={15} aria-hidden="true" />
                          </button>
                          <button
                            className="icon-button"
                            type="button"
                            aria-label={`Archive ${project.name}`}
                            disabled={pendingId !== null}
                            onClick={() => void handleArchive(project)}
                          >
                            <Archive size={15} aria-hidden="true" />
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              !error && (
                <div className="panel-card empty-state">
                  <h3>No active projects</h3>
                  <p className="empty-text">Create a project to group related tasks.</p>
                  <button
                    className="button"
                    type="button"
                    onClick={() => setIsCreateFormOpen(true)}
                  >
                    <Plus size={16} aria-hidden="true" />
                    Create a project
                  </button>
                </div>
              )
            )}

            {archivedProjects.length > 0 && (
              <section className="archived-projects" aria-labelledby="archived-projects-heading">
                <h3 id="archived-projects-heading">Archived projects</h3>
                <ul className="project-list">
                  {archivedProjects.map((project) => (
                    <li className="project-card archived-project-card" key={project.id}>
                      <div className="project-summary">
                        <span className="project-name">{project.name}</span>
                        {project.description && (
                          <span className="project-description">{project.description}</span>
                        )}
                      </div>
                      <button
                        className="button"
                        type="button"
                        disabled={pendingId !== null}
                        onClick={() => void handleRestore(project)}
                      >
                        <ArchiveRestore size={15} aria-hidden="true" />
                        Restore
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <section className="project-tasks-panel" aria-labelledby="project-tasks-heading">
            {selectedProject ? (
              <>
                <header className="project-tasks-header">
                  <div>
                    <p className="eyebrow">Project tasks</p>
                    <h3 id="project-tasks-heading">{selectedProject.name}</h3>
                  </div>
                  <div className="project-task-actions">
                    <span className="chip">{tasks.length}</span>
                    <button
                      className="button primary"
                      type="button"
                      disabled={isCreateTaskFormOpen}
                      onClick={() => {
                        setIsCreateTaskFormOpen(true);
                        setError(null);
                        setNotice(null);
                      }}
                    >
                      <Plus size={15} aria-hidden="true" />
                      New task
                    </button>
                  </div>
                </header>
                {selectedProject.description && (
                  <p className="project-description">{selectedProject.description}</p>
                )}
                {completedTaskUndo && (
                  <p className="feedback success-feedback" role="status">
                    <span>Completed “{completedTaskUndo.title}”.</span>
                    <button
                      className="button"
                      type="button"
                      disabled={pendingId !== null}
                      onClick={() => void handleUndoTaskCompletion()}
                    >
                      <Undo2 size={15} aria-hidden="true" />
                      Undo
                    </button>
                  </p>
                )}
                {isCreateTaskFormOpen && (
                  <TaskForm
                    fixedProject={selectedProject}
                    submitLabel="Create task"
                    onSubmit={handleCreateTask}
                    onCancel={() => setIsCreateTaskFormOpen(false)}
                  />
                )}
                {areTasksLoading ? (
                  <div className="panel-card loading-state" role="status">
                    Loading project tasks…
                  </div>
                ) : tasks.length > 0 ? (
                  <ul className="task-list" aria-label={`${selectedProject.name} tasks`}>
                    {tasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        isPending={pendingId === task.id}
                        onSave={(input) => handleTaskUpdate(task, input)}
                        onComplete={() => void handleTaskComplete(task)}
                        onArchive={() => void handleTaskArchive(task)}
                      />
                    ))}
                  </ul>
                ) : (
                  <div className="panel-card empty-state">
                    <h3>No tasks in this project</h3>
                    <p className="empty-text">
                      Create a task here or assign an existing task using its task editor.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="panel-card empty-state">
                <h3>Select a project</h3>
                <p className="empty-text">Choose a project to see its assigned tasks.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
