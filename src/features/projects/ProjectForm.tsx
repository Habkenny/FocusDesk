import { useState, type FormEvent } from "react";

import type { Project, ProjectInput } from "../../types/project";

interface ProjectFormProps {
  project?: Project;
  submitLabel: string;
  onSubmit: (input: ProjectInput) => Promise<void>;
  onCancel: () => void;
}

export function ProjectForm({ project, submitLabel, onSubmit, onCancel }: ProjectFormProps) {
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      await onSubmit({ name, description });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="panel-card task-form project-form" onSubmit={handleSubmit}>
      <label>
        <span className="field-label">Project name</span>
        <input
          autoFocus
          required
          maxLength={200}
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
        />
      </label>
      <label>
        <span className="field-label">Description</span>
        <textarea
          rows={3}
          maxLength={10_000}
          value={description}
          onChange={(event) => setDescription(event.currentTarget.value)}
        />
      </label>
      {error && (
        <p className="inline-error" role="alert">
          Project was not saved. {error}
        </p>
      )}
      <div className="task-form-actions">
        <button className="button" type="button" disabled={isSaving} onClick={onCancel}>
          Cancel
        </button>
        <button className="button primary" type="submit" disabled={isSaving}>
          {isSaving ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
