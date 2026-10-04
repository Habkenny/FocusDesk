import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InboxPage } from "../features/inbox/InboxPage";
import type { Task } from "../types/task";

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
  invokeMock.mockImplementation((command: string, args?: { title?: string; id?: string }) => {
    if (command === "list_inbox_tasks") {
      return Promise.resolve(persistedTasks.filter((task) => task.status === "INBOX"));
    }
    if (command === "create_task") {
      const task: Task = {
        id: "task-1",
        title: args?.title ?? "",
        status: "INBOX",
        priority: "NONE",
        createdAt: "2026-10-04T00:00:00.000Z",
        updatedAt: "2026-10-04T00:00:00.000Z",
        completedAt: null,
      };
      persistedTasks = [task, ...persistedTasks];
      return Promise.resolve(task);
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
    return Promise.reject(new Error(`Unexpected command: ${command}`));
  });
});

describe("Inbox task workflow", () => {
  it("creates a task, reloads it, and completes it", async () => {
    const firstRender = render(<InboxPage />);
    await screen.findByText("No tasks in your inbox");

    fireEvent.click(screen.getByRole("button", { name: /add your first task/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /what needs to be done/i }), {
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
    fireEvent.change(screen.getByRole("textbox", { name: /what needs to be done/i }), {
      target: { value: "Do not lose this task" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create task/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to save this task.");
    expect(screen.queryByText("Do not lose this task")).not.toBeInTheDocument();
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
