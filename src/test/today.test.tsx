import { addDays, format } from "date-fns";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TodayPage } from "../features/today/TodayPage";
import type { Task } from "../types/task";

const { invokeMock, isTauriMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  isTauriMock: vi.fn(() => true),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock, isTauri: isTauriMock }));

beforeEach(() => {
  isTauriMock.mockReturnValue(true);
  invokeMock.mockReset();
  invokeMock.mockImplementation((command: string, args?: { today?: string }) => {
    if (command !== "list_today_tasks") {
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    }
    const today = args?.today ?? format(new Date(), "yyyy-MM-dd");
    const tomorrow = format(addDays(new Date(`${today}T12:00:00`), 1), "yyyy-MM-dd");
    const baseTask = {
      description: null,
      priority: "NONE" as const,
      startAt: null,
      estimatedDuration: null,
      position: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archivedAt: null,
    };
    const tasks: Task[] = [
      {
        ...baseTask,
        id: "overdue",
        title: "Past due",
        status: "TODO",
        dueAt: "2020-01-01",
        completedAt: null,
      },
      {
        ...baseTask,
        id: "today",
        title: "Due today",
        status: "INBOX",
        dueAt: today,
        completedAt: null,
      },
      {
        ...baseTask,
        id: "scheduled",
        title: "Later task",
        status: "TODO",
        dueAt: tomorrow,
        completedAt: null,
      },
      {
        ...baseTask,
        id: "done",
        title: "Finished today",
        status: "DONE",
        dueAt: today,
        completedAt: new Date().toISOString(),
      },
    ];
    return Promise.resolve(tasks);
  });
});

describe("Today view", () => {
  it("groups overdue, due, scheduled, and completed tasks", async () => {
    render(<TodayPage />);

    expect(await screen.findByText("Past due")).toBeInTheDocument();
    expect(screen.getByText("Due today")).toBeInTheDocument();
    expect(screen.getByText("Later task")).toBeInTheDocument();
    expect(screen.getByText("Finished today")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Overdue" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Scheduled" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Completed" })).toBeInTheDocument();
  });
});
