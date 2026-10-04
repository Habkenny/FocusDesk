import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InboxPage } from "../features/inbox/InboxPage";
import type { Task, TaskInput } from "../types/task";

const { invokeMock, isTauriMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  isTauriMock: vi.fn(() => true),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock, isTauri: isTauriMock }));

let persistedTasks: Task[];

beforeEach(() => {
  persistedTasks = [];
  invokeMock.mockReset();
  isTauriMock.mockReturnValue(true);
  invokeMock.mockImplementation(
    (command: string, args?: { input?: TaskInput; id?: string; today?: string }) => {
      if (command === "list_inbox_tasks") {
        return Promise.resolve(persistedTasks.filter((task) => task.status === "INBOX"));
      }
      if (command === "list_today_tasks") {
        return Promise.resolve(
          persistedTasks.filter((task) => task.dueAt || task.status === "DONE"),
        );
      }
      if (command === "create_task") {
        const input = args?.input;
        const task: Task = {
          id: "task-1",
          title: input?.title ?? "",
          description: input?.description ?? null,
          status: input?.status ?? "INBOX",
          priority: input?.priority ?? "NONE",
          dueAt: input?.dueAt ?? null,
          startAt: null,
          estimatedDuration: null,
          position: 0,
          createdAt: "2026-10-04T00:00:00.000Z",
          updatedAt: "2026-10-04T00:00:00.000Z",
          completedAt: null,
          archivedAt: null,
        };
        persistedTasks = [task, ...persistedTasks];
        return Promise.resolve(task);
      }
      if (command === "update_task") {
        const currentTask = persistedTasks.find(({ id }) => id === args?.id);
        if (!currentTask || !args?.input) return Promise.reject(new Error("Task not found"));
        const updatedTask = {
          ...currentTask,
          ...args.input,
          description: args.input.description,
          dueAt: args.input.dueAt,
        };
        persistedTasks = persistedTasks.map((task) =>
          task.id === updatedTask.id ? updatedTask : task,
        );
        return Promise.resolve(updatedTask);
      }
      if (command === "complete_task") {
        const task = persistedTasks.find(({ id }) => id === args?.id);
        if (!task) {
          return Promise.reject(new Error("Task not found"));
        }

        const completedTask = {
          ...task,
          status: "DONE" as const,
          completedAt: "2026-10-04T00:01:00.000Z",
        };
        persistedTasks = persistedTasks.map((item) => (item.id === task.id ? completedTask : item));
        return Promise.resolve(completedTask);
      }
      if (command === "undo_task_completion" || command === "restore_task") {
        const task = persistedTasks.find(({ id }) => id === args?.id);
        if (!task) return Promise.reject(new Error("Task not found"));
        const restored = {
          ...task,
          status: command === "undo_task_completion" ? ("INBOX" as const) : task.status,
          completedAt: command === "undo_task_completion" ? null : task.completedAt,
          archivedAt: null,
        };
        persistedTasks = persistedTasks.map((item) => (item.id === task.id ? restored : item));
        return Promise.resolve(restored);
      }
      if (command === "archive_task") {
        const task = persistedTasks.find(({ id }) => id === args?.id);
        if (!task) return Promise.reject(new Error("Task not found"));
        const archived = { ...task, archivedAt: "2026-10-04T00:02:00.000Z" };
        persistedTasks = persistedTasks.map((item) => (item.id === task.id ? archived : item));
        return Promise.resolve(archived);
      }
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    },
  );
});

describe("Inbox task workflow", () => {
  it("creates a task, reloads it, and completes it", async () => {
    const firstRender = render(<InboxPage />);
    await screen.findByText("No tasks in your inbox");

    fireEvent.click(screen.getByRole("button", { name: /add your first task/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /title/i }), {
      target: { value: "Write persistence test" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create task/i }));

    expect(await screen.findByText("Write persistence test")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Task saved to your inbox.");
    firstRender.unmount();

    render(<InboxPage />);
    expect(await screen.findByText("Write persistence test")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Complete Write persistence test" }));
    await waitFor(() => {
      expect(screen.queryByText("Write persistence test")).not.toBeInTheDocument();
    });
    expect(persistedTasks[0]?.status).toBe("DONE");
    expect(persistedTasks[0]?.completedAt).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(await screen.findByText("Write persistence test")).toBeInTheDocument();
    expect(persistedTasks[0]?.status).toBe("INBOX");
    expect(persistedTasks[0]?.completedAt).toBeNull();
  });

  it("shows a save error without pretending the task was created", async () => {
    invokeMock.mockImplementation((command: string) => {
      if (command === "list_inbox_tasks") {
        return Promise.resolve([]);
      }
      return Promise.reject(new Error("Database is unavailable"));
    });

    render(<InboxPage />);
    fireEvent.click(await screen.findByRole("button", { name: /add your first task/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /title/i }), {
      target: { value: "Do not lose this task" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create task/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save task.");
    expect(screen.queryByText("Do not lose this task")).not.toBeInTheDocument();
  });

  it("edits task fields and supports archive with undo", async () => {
    render(<InboxPage />);
    await screen.findByText("No tasks in your inbox");
    fireEvent.click(screen.getByRole("button", { name: /add your first task/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /title/i }), {
      target: { value: "Draft release notes" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create task/i }));
    await screen.findByText("Draft release notes");

    fireEvent.click(screen.getByRole("button", { name: "Edit Draft release notes" }));
    fireEvent.change(screen.getByRole("textbox", { name: /title/i }), {
      target: { value: "Write release notes" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /description/i }), {
      target: { value: "Include the key changes" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /priority/i }), {
      target: { value: "HIGH" },
    });
    fireEvent.change(screen.getByLabelText(/due date/i), {
      target: { value: "2026-10-04" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await screen.findByText("Write release notes");
    expect(persistedTasks[0]).toMatchObject({
      title: "Write release notes",
      description: "Include the key changes",
      priority: "HIGH",
      dueAt: "2026-10-04",
    });

    fireEvent.click(screen.getByRole("button", { name: "Archive Write release notes" }));
    await waitFor(() => {
      expect(screen.queryByText("Write release notes")).not.toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(await screen.findByText("Write release notes")).toBeInTheDocument();
    expect(persistedTasks[0]?.archivedAt).toBeNull();
  });

  it("explains that task storage requires the desktop app in a browser", async () => {
    isTauriMock.mockReturnValue(false);

    render(<InboxPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Task storage requires the FocusDesk desktop app.",
    );
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
