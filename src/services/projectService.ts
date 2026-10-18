import { z } from "zod";

import { projectRepository } from "../repositories/projectRepository";
import type { ProjectInput } from "../types/project";

const projectInputSchema = z.object({
  name: z.string().trim().min(1, "Enter a project name.").max(200),
  description: z.string().max(10_000),
});

function validateInput(input: ProjectInput): ProjectInput {
  const validation = projectInputSchema.safeParse({
    ...input,
    description: input.description ?? "",
  });
  if (!validation.success) {
    throw new Error(validation.error.issues[0]?.message ?? "Check the project details and try again.");
  }
  return {
    name: validation.data.name,
    description: validation.data.description.trim() || null,
  };
}

export const projectService = {
  list() {
    return projectRepository.list();
  },

  listTasks(id: string) {
    return projectRepository.listTasks(id);
  },

  create(input: ProjectInput) {
    return projectRepository.create(validateInput(input));
  },

  update(id: string, input: ProjectInput) {
    return projectRepository.update(id, validateInput(input));
  },

  archive(id: string) {
    return projectRepository.archive(id);
  },

  restore(id: string) {
    return projectRepository.restore(id);
  },
};
