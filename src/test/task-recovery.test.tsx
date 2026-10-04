import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ArchivedPage } from "../features/tasks/ArchivedPage";
import { AllTasksPage } from "../features/tasks/AllTasksPage";
import { InboxPage } from "../features/inbox/InboxPage";
import type { Task, TaskInput } from "../types/task";

const { invokeMock, isTauriMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  isTauriMock: vi.fn(() => true),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock, isTauri: isTauriMock }));

let persistedTasks: Task[];

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Prepare project plan",
    description: null,
    status: "INBOX",
    priority: "NONE",
    projectId: null,
    dueAt: null,
    startAt: null,
    estimatedDuration: null,
    position: 0,
    createdAt: "2026-10-04T00:00:00.000Z",
    updatedAt: "2026-10-04T00:00:00.000Z",
    completedAt: null,
    archivedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  persistedTasks = [makeTask()];
  invokeMock.mockReset();
  isTauriMock.mockReturnValue(true);
  invokeMock.mockImplementation(
    (command: string, args?: { id?: string; input?: TaskInput }) => {
      if (command === "list_projects") return Promise.resolve([]);
      if (command === "list_inbox_tasks") {
        return Promise.resolve(persistedTasks.filter((task) => task.status === "INBOX"));
      }
      if (command === "list_active_tasks") {
        return Promise.resolve(
          persistedTasks.filter((task) => task.status !== "DONE" && task.archivedAt === null),
        );
      }
      if (command === "list_archived_tasks") {
        return Promise.resolve(persistedTasks.filter((task) => task.archivedAt !== null));
      }
      if (command === "update_task") {
        const task = persistedTasks.find(({ id }) => id === args?.id);
        if (!task || !args?.input) return Promise.reject(new Error("Task not found"));
        const updated = { ...task, ...args.input };
        persistedTasks = persistedTasks.map((item) => (item.id === task.id ? updated : item));
        return Promise.resolve(updated);
      }
      if (command === "restore_task") {
        const task = persistedTasks.find(({ id }) => id === args?.id);
        if (!task || task.archivedAt === null) {
          return Promise.reject(new Error("Task not archived"));
        }
        const restored = { ...task, archivedAt: null };
        persistedTasks = persistedTasks.map((item) => (item.id === task.id ? restored : item));
        return Promise.resolve(restored);
      }
      if (command === "permanently_delete_archived_task") {
        const task = persistedTasks.find(({ id }) => id === args?.id);
        if (!task || task.archivedAt === null) {
          return Promise.reject(new Error("Task not archived"));
        }
        persistedTasks = persistedTasks.filter((item) => item.id !== task.id);
        return Promise.resolve(task);
      }
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    },
  );
});

describe("task reachability and archive recovery", () => {
  it("keeps an undated task reachable after moving it out of Inbox", async () => {
    const inbox = render(<InboxPage />);
    await screen.findByText("Prepare project plan");
    fireEvent.click(screen.getByRole("button", { name: "Edit Prepare project plan" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Status" }), {
      target: { value: "TODO" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("No tasks in your inbox");
    expect(persistedTasks[0]?.dueAt).toBeNull();
    expect(persistedTasks[0]?.status).toBe("TODO");
    inbox.unmount();

    render(<AllTasksPage />);

    expect(await screen.findByText("Prepare project plan")).toBeInTheDocument();
    expect(screen.getByLabelText("All active tasks")).toBeInTheDocument();
    expect(screen.getByText("TODO")).toBeInTheDocument();
  });

  it("restores an archived task and retains the change after reloading the archive", async () => {
    persistedTasks = [makeTask({ archivedAt: "2026-10-04T00:02:00.000Z" })];

    const archive = render(<ArchivedPage />);
    expect(await screen.findByText("Prepare project plan")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Restored “Prepare project plan” to All tasks.",
    );
    expect(persistedTasks[0]?.archivedAt).toBeNull();
    archive.unmount();

    render(<ArchivedPage />);
    expect(await screen.findByText("Archive is empty")).toBeInTheDocument();
    expect(invokeMock).toHaveBeenCalledWith("list_archived_tasks");
  });

  it("requires explicit confirmation before permanently deleting an archived task", async () => {
    persistedTasks = [makeTask({ archivedAt: "2026-10-04T00:02:00.000Z" })];
    render(<ArchivedPage />);

    await screen.findByText("Prepare project plan");
    fireEvent.click(
      screen.getByRole("button", { name: "Permanently delete Prepare project plan" }),
    );
    expect(screen.getByRole("alertdialog")).toHaveTextContent("This cannot be undone.");
    expect(invokeMock).not.toHaveBeenCalledWith("permanently_delete_archived_task", {
      id: "task-1",
    });

    fireEvent.click(screen.getByRole("button", { name: "Confirm permanent deletion" }));
    await waitFor(() => expect(persistedTasks).toHaveLength(0));
    expect(await screen.findByText("Archive is empty")).toBeInTheDocument();
    expect(invokeMock).toHaveBeenCalledWith("permanently_delete_archived_task", {
      id: "task-1",
    });
  });
});
