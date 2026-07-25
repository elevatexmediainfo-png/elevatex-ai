"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Film, Folder, FolderPlus, MoreVertical, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { VideoStatusBadge } from "@/components/shared/video-status-badge";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { editorApi } from "./api-client";
import { EDITOR_ASPECT_RATIO_PRESETS, formatTimecode, type EditorAspectRatio, type FolderView, type ProjectView } from "./types";

// B4 Phase 3 (2026-07-22) — see editor/page.tsx's own comment for why this
// exists. Deliberately a plain local type, not added to types.ts's
// EditorProject-family types — this is legacy VideoProject data passing
// through, not a Cloud Video Editor concept.
export interface LegacyVideoProjectView {
  id: string;
  title: string;
  status: string;
  sourceType: string;
  updatedAt: string;
}

export function ProjectBrowser({
  initialFolders,
  initialProjects,
  legacyProjects,
}: {
  initialFolders: FolderView[];
  initialProjects: ProjectView[];
  legacyProjects: LegacyVideoProjectView[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [currentFolderId, setCurrentFolderId] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<"projects" | "legacy">("projects");

  const foldersQuery = useQuery({
    queryKey: ["editor", "folders"],
    queryFn: () => editorApi<{ folders: FolderView[] }>("/api/editor/folders", "GET").then((d) => d.folders),
    initialData: initialFolders,
  });

  const projectsQuery = useQuery({
    queryKey: ["editor", "projects"],
    queryFn: () => editorApi<{ projects: ProjectView[] }>("/api/editor/projects", "GET").then((d) => d.projects),
    initialData: initialProjects,
  });

  const folders = foldersQuery.data ?? [];
  const projects = (projectsQuery.data ?? []).filter((p) => p.folderId === currentFolderId);
  const subfolders = folders.filter((f) => f.parentId === currentFolderId);
  const currentFolder = folders.find((f) => f.id === currentFolderId) ?? null;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["editor", "folders"] });
    queryClient.invalidateQueries({ queryKey: ["editor", "projects"] });
  };

  const createFolder = useMutation({
    mutationFn: (name: string) =>
      editorApi("/api/editor/folders", "POST", { name, parentId: currentFolderId ?? undefined }),
    onSuccess: invalidate,
  });

  const deleteFolder = useMutation({
    mutationFn: (id: string) => editorApi(`/api/editor/folders/${id}`, "DELETE"),
    onSuccess: invalidate,
  });

  const createProject = useMutation({
    mutationFn: (input: { name: string; aspectRatio: EditorAspectRatio; widthPx: number; heightPx: number }) =>
      editorApi<{ project: ProjectView }>("/api/editor/projects", "POST", {
        ...input,
        folderId: currentFolderId ?? undefined,
      }),
    onSuccess: (data) => {
      invalidate();
      router.push(`/editor/${data.project.id}`);
    },
  });

  const duplicateProject = useMutation({
    mutationFn: (id: string) => editorApi(`/api/editor/projects/${id}/duplicate`, "POST", {}),
    onSuccess: invalidate,
  });

  const deleteProject = useMutation({
    mutationFn: (id: string) => editorApi(`/api/editor/projects/${id}`, "DELETE"),
    onSuccess: invalidate,
  });

  const renameProject = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => editorApi(`/api/editor/projects/${id}`, "PATCH", { name }),
    onSuccess: invalidate,
  });

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-2 text-heading-3">
          <Film className="size-5 text-editor-accent" />
          <span>AI Video Editor</span>
          {currentFolder && (
            <>
              <span className="text-neutral-500">/</span>
              <span className="text-neutral-300">{currentFolder.name}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <NewFolderDialog onCreate={(name) => createFolder.mutate(name)} />
          <NewProjectDialog onCreate={(input) => createProject.mutate(input)} pending={createProject.isPending} />
        </div>
      </header>

      {/* B4 Phase 3 (2026-07-22) — replaces the "AI Studio"/"Talking Head"
          top-level sidebar entries; see editor/page.tsx's comment. */}
      <div className="flex items-center gap-1 border-b border-white/10 px-6">
        <button
          type="button"
          onClick={() => setActiveTab("projects")}
          className={cn(
            "border-b-2 px-3 py-2.5 text-label-sm transition-colors",
            activeTab === "projects" ? "border-editor-accent text-white" : "border-transparent text-neutral-400 hover:text-white"
          )}
        >
          Projects
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("legacy")}
          className={cn(
            "border-b-2 px-3 py-2.5 text-label-sm transition-colors",
            activeTab === "legacy" ? "border-editor-accent text-white" : "border-transparent text-neutral-400 hover:text-white"
          )}
        >
          Legacy videos{legacyProjects.length > 0 && ` (${legacyProjects.length})`}
        </button>
      </div>

      {activeTab === "legacy" ? (
        <div className="flex-1 overflow-y-auto p-6">
          <p className="mb-4 text-body-sm text-neutral-400">
            Videos created with the earlier AI Studio / Talking Head flow. These still open in their original editor —
            they aren&apos;t part of this project library.
          </p>
          {legacyProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-neutral-500">
              <Film className="size-10" />
              <p className="text-body-md">No legacy videos.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {legacyProjects.map((p) => (
                <Link
                  key={p.id}
                  href={`/videos/${p.id}`}
                  className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/5 p-3 hover:border-white/20 hover:bg-white/10"
                >
                  <div className="min-w-0">
                    <p className="truncate text-label-sm text-white">{p.title}</p>
                    <p className="text-caption text-neutral-500">
                      {p.sourceType === "TALKING_HEAD_UPLOAD" ? "Talking Head" : "AI Studio"} · Last edited {formatDate(new Date(p.updatedAt))}
                    </p>
                  </div>
                  <VideoStatusBadge status={p.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : (
      <div className="flex-1 overflow-y-auto p-6">
        {currentFolderId && (
          <button
            type="button"
            onClick={() => setCurrentFolderId(currentFolder?.parentId ?? null)}
            className="mb-4 text-label-sm text-neutral-400 hover:text-white"
          >
            ← Back
          </button>
        )}

        {subfolders.length > 0 && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {subfolders.map((folder) => (
              <div
                key={folder.id}
                className="group relative flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-4 hover:bg-white/10"
                onClick={() => setCurrentFolderId(folder.id)}
              >
                <Folder className="size-8 text-editor-accent" />
                <span className="w-full truncate text-center text-label-sm">{folder.name}</span>
                <button
                  type="button"
                  className="absolute top-1 right-1 hidden rounded p-1 text-neutral-400 hover:bg-white/10 hover:text-editor-danger group-hover:block"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteFolder.mutate(folder.id);
                  }}
                  title="Delete folder"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-neutral-500">
            <Film className="size-10" />
            <p className="text-body-md">No projects here yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={() => router.push(`/editor/${project.id}`)}
                onRename={(name) => renameProject.mutate({ id: project.id, name })}
                onDuplicate={() => duplicateProject.mutate(project.id)}
                onDelete={() => deleteProject.mutate(project.id)}
              />
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
}: {
  project: ProjectView;
  onOpen: () => void;
  onRename: (name: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const ratio = project.widthPx / project.heightPx;

  return (
    <div className="group flex flex-col overflow-hidden rounded-lg border border-white/10 bg-white/5 hover:border-white/20">
      <button
        type="button"
        onClick={onOpen}
        className="relative flex items-center justify-center bg-black/40"
        style={{ aspectRatio: ratio }}
      >
        <Film className="size-8 text-neutral-600" />
      </button>
      <div className="flex items-center justify-between gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-label-sm">{project.name}</p>
          <p className="text-caption text-neutral-500">{formatTimecode(project.durationMs)}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-neutral-400 hover:text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={onOpen}>Open</DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                const name = window.prompt("Rename project", project.name);
                if (name && name.trim()) onRename(name.trim());
              }}
            >
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>Duplicate</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function NewFolderDialog({ onCreate }: { onCreate: (name: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          <FolderPlus className="size-4" />
          New Folder
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Folder</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="folder-name">Name</Label>
          <Input id="folder-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <DialogFooter>
          <Button
            type="button"
            disabled={!name.trim()}
            onClick={() => {
              onCreate(name.trim());
              setName("");
              setOpen(false);
            }}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewProjectDialog({
  onCreate,
  pending,
}: {
  onCreate: (input: { name: string; aspectRatio: EditorAspectRatio; widthPx: number; heightPx: number }) => void;
  pending: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("Untitled Project");
  const [preset, setPreset] = React.useState<EditorAspectRatio>("RATIO_16_9");
  const [widthPx, setWidthPx] = React.useState(1920);
  const [heightPx, setHeightPx] = React.useState(1080);

  function handlePresetChange(value: EditorAspectRatio) {
    setPreset(value);
    const found = EDITOR_ASPECT_RATIO_PRESETS.find((p) => p.value === value);
    if (found && value !== "CUSTOM") {
      setWidthPx(found.widthPx);
      setHeightPx(found.heightPx);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          <Plus className="size-4" />
          New Project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Name</Label>
            <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-2">
            <Label>Aspect ratio</Label>
            <Select value={preset} onValueChange={(v) => handlePresetChange(v as EditorAspectRatio)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EDITOR_ASPECT_RATIO_PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {preset === "CUSTOM" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="project-width">Width (px)</Label>
                <Input
                  id="project-width"
                  type="number"
                  min={16}
                  value={widthPx}
                  onChange={(e) => setWidthPx(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-height">Height (px)</Label>
                <Input
                  id="project-height"
                  type="number"
                  min={16}
                  value={heightPx}
                  onChange={(e) => setHeightPx(Number(e.target.value) || 0)}
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            disabled={!name.trim() || pending}
            loading={pending}
            onClick={() => onCreate({ name: name.trim(), aspectRatio: preset, widthPx, heightPx })}
          >
            Create Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
