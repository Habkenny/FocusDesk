import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectsPage } from "../features/projects/ProjectsPage";
import { InboxPage } from "../features/inbox/InboxPage";
import type { Project, ProjectInput } from "../types/project";
import type { Task, TaskInput } from "../types/task";

const { invokeMock, isTauriMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  isTauriMock: vi.fn(() => true),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock, isTauri: isTauriMock }));

let persistedProjects: Project[];
let persistedTasks: Task[];

beforeEach(() => {
  persistedProjects = [];
  persistedTasks = [];
  invokeMock.mockReset();
  isTauriMock.mockReturnValue(true);
  invokeMock.mockImplementation(
    (
      command: string,
      args?: { id?: string; input?: ProjectInput | TaskInput; projectId?: string },
    ) => {
      if (command === "list_projects") return Promise.resolve([...persistedProjects]);
      if (command === "list_inbox_tasks") {
        return Promise.resolve(persistedTasks.filter((task) => task.status === "INBOX"));
      }
      if (command === "list_project_tasks") {
        return Promise.resolve(
          persistedTasks.filter((task) => task.projectId === args?.projectId && task.archivedAt === null),
        );
      }
      if (command === "create_project") {
        const input = args?.input;
        if (!input || !("name" in input)) {
          return Promise.reject(new Error("Project input is required"));
        }
        const project: Project = {
          id: `project-${persistedProjects.length + 1}`,
          name: input.name,
          description: input.description,
          status: "ACTIVE",
          createdAt: "2026-10-04T00:00:00.000Z",
          updatedAt: "2026-10-04T00:00:00.000Z",
        };
        persistedProjects = [...persistedProjects, project];
        return Promise.resolve(project);
      }
      if (command === "create_task") {
        const input = args?.input;
        if (!input || !("title" in input)) {
          return Promise.reject(new Error("Task input is required"));
        }
        const task: Task = {
          id: `task-${persistedTasks.length + 1}`,
          title: input.title,
          description: input.description,
          status: input.status,
          priority: input.priority,
          projectId: input.projectId,
          dueAt: input.dueAt,
          startAt: null,
          estimatedDuration: null,
          position: 0,
          createdAt: "2026-10-04T00:00:00.000Z",
          updatedAt: "2026-10-04T00:00:00.000Z",
          completedAt: null,
          archivedAt: null,
        };
        persistedTasks = [...persistedTasks, task];
        return Promise.resolve(task);
      }
      if (command === "update_project") {
        const current = persistedProjects.find(({ id }) => id === args?.id);
        const input = args?.input;
        if (!current || !input || !("name" in input)) {
          return Promise.reject(new Error("Project not found"));
        }
        const updated = { ...current, ...input };
        persistedProjects = persistedProjects.map((project) =>
          project.id === updated.id ? updated : project,
        );
        return Promise.resolve(updated);
      }
      if (command === "archive_project" || command === "restore_project") {
        const current = persistedProjects.find(({ id }) => id === args?.id);
        if (!current) return Promise.reject(new Error("Project not found"));
        const updated = {
          ...current,
          status: command === "archive_project" ? ("ARCHIVED" as const) : ("ACTIVE" as const),
        };
        persistedProjects = persistedProjects.map((project) =>
          project.id === updated.id ? updated : project,
        );
        return Promise.resolve(updated);
      }
      if (command === "complete_task") {
        const current = persistedTasks.find(({ id }) => id === args?.id);
        if (!current) return Promise.reject(new Error("Task not found"));
        const completed = { ...current, status: "DONE" as const, completedAt: "2026-10-04T00:01:00Z" };
        persistedTasks = persistedTasks.map((task) => (task.id === current.id ? completed : task));
        return Promise.resolve(completed);
      }
      if (command === "undo_task_completion") {
        const current = persistedTasks.find(({ id }) => id === args?.id);
        if (!current) return Promise.reject(new Error("Task not found"));
        const restored = {
          ...current,
          status: "INBOX" as const,
          completedAt: null,
        };
        persistedTasks = persistedTasks.map((task) => (task.id === current.id ? restored : task));
        return Promise.resolve(restored);
      }
      if (command === "archive_task") {
        const current = persistedTasks.find(({ id }) => id === args?.id);
        if (!current) return Promise.reject(new Error("Task not found"));
        const archived = { ...current, archivedAt: "2026-10-04T00:02:00Z" };
        persistedTasks = persistedTasks.map((task) => (task.id === current.id ? archived : task));
        return Promise.resolve(archived);
      }
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    },
  );
});

describe("Projects", () => {
  it("assigns a new task to a project from the task editor form", async () => {
    persistedProjects = [
      {
        id: "project-1",
        name: "Website launch",
        description: null,
        status: "ACTIVE",
        createdAt: "2026-10-04T00:00:00.000Z",
        updatedAt: "2026-10-04T00:00:00.000Z",
      },
    ];
    render(<InboxPage />);
    await screen.findByText("No tasks in your inbox");
    fireEvent.click(screen.getByRole("button", { name: /add your first task/i }));
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), {
      target: { value: "Prepare release notes" },
    });
    fireEvent.change(await screen.findByRole("combobox", { name: "Project" }), {
      target: { value: "project-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create task" }));

    expect(await screen.findByText("Prepare release notes")).toBeInTheDocument();
    expect(persistedTasks[0]?.projectId).toBe("project-1");
    expect(invokeMock).toHaveBeenCalledWith(
      "create_task",
      expect.objectContaining({ input: expect.objectContaining({ projectId: "project-1" }) }),
    );
  });

  it("creates, edits, archives, and restores a project without losing its tasks", async () => {
    const page = render(<ProjectsPage />);
    await screen.findByText("No active projects");
    fireEvent.click(screen.getByRole("button", { name: "New project" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Project name" }), {
      target: { value: "Website launch" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Description" }), {
      target: { value: "Release planning" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));

    expect(await screen.findByRole("heading", { name: "Website launch" })).toBeInTheDocument();
    expect(persistedProjects[0]).toMatchObject({
      name: "Website launch",
      description: "Release planning",
    });

    persistedTasks = [
      {
        id: "task-1",
        title: "Prepare launch",
        description: null,
        status: "TODO",
        priority: "HIGH",
        projectId: persistedProjects[0]!.id,
        dueAt: null,
        startAt: null,
        estimatedDuration: null,
        position: 0,
        createdAt: "2026-10-04T00:00:00.000Z",
        updatedAt: "2026-10-04T00:00:00.000Z",
        completedAt: null,
        archivedAt: null,
      },
    ];
    page.unmount();
    render(<ProjectsPage />);
    expect(await screen.findByText("Prepare launch")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit Website launch" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Project name" }), {
      target: { value: "Website launch v1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save project" }));
    await screen.findByRole("heading", { name: "Website launch v1" });
    expect(persistedProjects[0]?.name).toBe("Website launch v1");

    fireEvent.click(screen.getByRole("button", { name: "Archive Website launch v1" }));
    expect(await screen.findByRole("heading", { name: "Archived projects" })).toBeInTheDocument();
    expect(persistedTasks[0]?.projectId).toBe(persistedProjects[0]?.id);

    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() => expect(persistedProjects[0]?.status).toBe("ACTIVE"));
    expect(await screen.findByText("Prepare launch")).toBeInTheDocument();
  });

  it("creates a task from its project and allows completion to be undone", async () => {
    persistedProjects = [
      {
        id: "project-1",
        name: "Desktop release",
        description: null,
        status: "ACTIVE",
        createdAt: "2026-10-04T00:00:00.000Z",
        updatedAt: "2026-10-04T00:00:00.000Z",
      },
    ];
    render(<ProjectsPage />);
    await screen.findByRole("heading", { name: "Desktop release" });
    fireEvent.click(screen.getByRole("button", { name: "New task" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), {
      target: { value: "Verify installer" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create task" }));

    expect(await screen.findByText("Verify installer")).toBeInTheDocument();
    expect(persistedTasks[0]?.projectId).toBe("project-1");

    fireEvent.click(screen.getByRole("button", { name: "Complete Verify installer" }));
    expect(await screen.findByText("Completed “Verify installer”.")).toBeInTheDocument();
    expect(persistedTasks[0]?.status).toBe("DONE");
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    await waitFor(() => expect(persistedTasks[0]?.status).toBe("INBOX"));
    expect(screen.getByText("Verify installer")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Completion undone for “Verify installer”.",
    );
    expect(invokeMock).toHaveBeenCalledWith("undo_task_completion", { id: "task-1" });
  });
});
