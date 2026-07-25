"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { editorApi } from "../api-client";
import type { ProjectView } from "../types";

// Top Toolbar's inline-editable project name — local input state that
// commits (PATCH) on blur/Enter rather than on every keystroke.
export function useUpdateProjectName(project: ProjectView) {
  const [name, setName] = React.useState(project.name);
  const queryClient = useQueryClient();

  React.useEffect(() => setName(project.name), [project.name]);

  const rename = useMutation({
    mutationFn: (newName: string) => editorApi(`/api/editor/projects/${project.id}`, "PATCH", { name: newName }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["editor", "project", project.id] }),
  });

  function commit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(project.name);
      return;
    }
    if (trimmed !== project.name) rename.mutate(trimmed);
  }

  return { name, setName, commit };
}
