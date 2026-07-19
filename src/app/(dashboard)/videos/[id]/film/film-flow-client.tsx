"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, UploadCloud, Check, Film as FilmIcon, Clock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/shared/container";
import { cn } from "@/lib/utils";
import { putWithProgress } from "@/lib/upload/put-with-progress";
import { resolveFilmCharacterReferenceAssetId, type FilmBrief } from "@/lib/film/types";

type FilmCharacterStatus = "PENDING" | "VARIATIONS_READY" | "FACE_UPLOADED" | "SELECTED" | "SHEET_READY";
type SceneStatus = "DRAFT" | "PENDING" | "RENDERING" | "COMPLETED" | "FAILED" | "CANCELLED";

export interface FilmFlowCharacter {
  id: string;
  slotIndex: number;
  name: string | null;
  variationAssetIds: string[];
  selectedVariationAssetId: string | null;
  faceUploadSideAssetId: string | null;
  faceUploadFrontAssetId: string | null;
  characterSheet: Record<string, string> | null;
  status: FilmCharacterStatus;
}

export interface FilmFlowScene {
  id: string;
  order: number;
  prompt: string;
  durationSeconds: number;
  status: SceneStatus;
  filmCharacterId: string | null;
  errorMessage: string | null;
  videoUrl: string | null;
}

export interface FilmFlowProject {
  id: string;
  title: string;
  status: string;
  aspectRatio: string;
  brief: FilmBrief;
  previewVideoUrl: string | null;
}

interface FilmFlowClientProps {
  project: FilmFlowProject;
  characters: FilmFlowCharacter[];
  scenes: FilmFlowScene[];
  assetUrlById: Record<string, string>;
}

type FlowStep = "characters" | "sheets" | "storyboard" | "scenes" | "merge" | "done";

const STEP_LABELS: Record<FlowStep, string> = {
  characters: "Characters",
  sheets: "Character sheets",
  storyboard: "Storyboard",
  scenes: "Scene generation",
  merge: "Merge",
  done: "Done",
};
const STEP_ORDER: FlowStep[] = ["characters", "sheets", "storyboard", "scenes", "merge", "done"];

function resolveStep(project: FilmFlowProject, characters: FilmFlowCharacter[], scenes: FilmFlowScene[]): FlowStep {
  if (project.status === "COMPLETED" && project.previewVideoUrl) return "done";
  if (characters.some((c) => c.status !== "SELECTED" && c.status !== "SHEET_READY")) return "characters";
  if (characters.some((c) => c.status !== "SHEET_READY")) return "sheets";
  if (scenes.length === 0) return "storyboard";
  if (scenes.some((s) => s.status !== "COMPLETED")) return "scenes";
  return "merge";
}

// Never throws — a network failure or a non-JSON response (e.g. a dev-server
// hiccup) resolves to an honest { ok: false } instead of rejecting, so every
// caller's setBusy(null) actually runs. Before this, a thrown parse error
// here would skip a caller's own setBusy(null)/toast, leaving that card's
// buttons silently disabled forever with no visible error — the same
// externally-visible symptom as "clicking does nothing."
async function postJson(url: string, body?: unknown) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json();
    return { ok: json.success as boolean, data: json.data, message: json.error?.message as string | undefined };
  } catch {
    return { ok: false, data: undefined, message: "Network error. Please try again." };
  }
}

export function FilmFlowClient({ project, characters, scenes, assetUrlById }: FilmFlowClientProps) {
  const router = useRouter();
  const step = resolveStep(project, characters, scenes);

  return (
    <Container className="flex max-w-3xl flex-col py-10">
      <div className="mb-8">
        <h1 className="text-heading-1 text-neutral-900">{project.title}</h1>
        <p className="mt-1 text-body-sm text-neutral-500">{project.brief.idea}</p>
      </div>

      <div className="mb-8 flex items-center gap-2">
        {STEP_ORDER.map((s, i) => (
          <div key={s} className="flex flex-1 flex-col gap-1.5">
            <span
              className={cn(
                "h-1.5 rounded-full",
                STEP_ORDER.indexOf(step) >= i ? "bg-accent-orange" : "bg-neutral-200"
              )}
            />
            <span className="text-label-sm text-neutral-500">{STEP_LABELS[s]}</span>
          </div>
        ))}
      </div>

      {step === "characters" && (
        <CharacterStep projectId={project.id} characters={characters} assetUrlById={assetUrlById} onChanged={() => router.refresh()} />
      )}
      {step === "sheets" && (
        <SheetStep projectId={project.id} characters={characters} assetUrlById={assetUrlById} onChanged={() => router.refresh()} />
      )}
      {step === "storyboard" && (
        <StoryboardStep projectId={project.id} onChanged={() => router.refresh()} />
      )}
      {step === "scenes" && (
        <ScenesStep projectId={project.id} scenes={scenes} characters={characters} onChanged={() => router.refresh()} />
      )}
      {step === "merge" && (
        <div className="flex flex-col gap-8">
          {/* Founder requirement, 2026-07-12: reaching the merge-eligible
              state doesn't hide the per-scene review — every scene stays
              previewable and regeneratable right up until the founder
              explicitly clicks Merge below, not auto-jumped past. */}
          <ScenesStep projectId={project.id} scenes={scenes} characters={characters} onChanged={() => router.refresh()} />
          <MergeStep projectId={project.id} onChanged={() => router.refresh()} />
        </div>
      )}
      {step === "done" && <DoneStep videoUrl={project.previewVideoUrl!} />}
    </Container>
  );
}

function characterLabel(c: FilmFlowCharacter) {
  return c.name?.trim() || `Character ${c.slotIndex + 1}`;
}

function CharacterStep({
  projectId,
  characters,
  assetUrlById,
  onChanged,
}: {
  projectId: string;
  characters: FilmFlowCharacter[];
  assetUrlById: Record<string, string>;
  onChanged: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-heading-3 text-neutral-900">Choose each character</h2>
        <p className="mt-1 text-body-sm text-neutral-500">
          Generate 2 AI variations to pick from, or upload your own side + front photos instead.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {characters.map((c) => (
          <CharacterCard key={c.id} projectId={projectId} character={c} assetUrlById={assetUrlById} onChanged={onChanged} />
        ))}
      </div>
    </div>
  );
}

function CharacterCard({
  projectId,
  character,
  assetUrlById,
  onChanged,
}: {
  projectId: string;
  character: FilmFlowCharacter;
  assetUrlById: Record<string, string>;
  onChanged: () => void;
}) {
  const [busy, setBusy] = React.useState<"variations" | "select" | "upload-side" | "upload-front" | "confirm-upload" | null>(null);
  const [sideAssetId, setSideAssetId] = React.useState<string | null>(character.faceUploadSideAssetId);
  const [frontAssetId, setFrontAssetId] = React.useState<string | null>(character.faceUploadFrontAssetId);

  const base = `/api/videos/film/${projectId}/characters/${character.id}`;
  const isSelected = character.status === "SELECTED" || character.status === "SHEET_READY";

  async function generateVariations() {
    setBusy("variations");
    const { ok, message } = await postJson(`${base}/variations`);
    if (!ok) toast.error(message ?? "Couldn't generate variations.");
    setBusy(null);
    onChanged();
  }

  async function selectVariation(assetId: string) {
    setBusy("select");
    const { ok, message } = await postJson(`${base}/select`, { source: "variation", variationAssetId: assetId });
    if (!ok) toast.error(message ?? "Couldn't select this variation.");
    setBusy(null);
    onChanged();
  }

  async function uploadPhoto(file: File, slot: "side" | "front") {
    setBusy(slot === "side" ? "upload-side" : "upload-front");
    try {
      const urlRes = await fetch("/api/assets/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type, kind: "IMAGE", fileSizeBytes: file.size }),
      });
      const urlJson = await urlRes.json();
      if (!urlJson.success) {
        toast.error(urlJson.error?.message ?? "Couldn't start the upload.");
        return;
      }
      await putWithProgress(urlJson.data.uploadUrl, file, () => {});
      const confirmRes = await fetch(`/api/assets/${urlJson.data.assetId}/confirm-upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const confirmJson = await confirmRes.json();
      if (!confirmJson.success) {
        toast.error(confirmJson.error?.message ?? "Couldn't finish the upload.");
        return;
      }
      if (slot === "side") setSideAssetId(urlJson.data.assetId);
      else setFrontAssetId(urlJson.data.assetId);
    } catch {
      toast.error("Network error during upload. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function confirmFaceUpload(nextSideId: string, nextFrontId: string) {
    setBusy("confirm-upload");
    const { ok, message } = await postJson(`${base}/face-upload`, { sideAssetId: nextSideId, frontAssetId: nextFrontId });
    if (!ok) {
      toast.error(message ?? "Couldn't save the uploaded photos.");
      setBusy(null);
      return;
    }
    const sel = await postJson(`${base}/select`, { source: "face_upload" });
    if (!sel.ok) toast.error(sel.message ?? "Couldn't finalize this character.");
    setBusy(null);
    onChanged();
  }

  React.useEffect(() => {
    if (sideAssetId && frontAssetId && character.status !== "SELECTED" && character.status !== "SHEET_READY") {
      void confirmFaceUpload(sideAssetId, frontAssetId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sideAssetId, frontAssetId]);

  return (
    <div className={cn("rounded-xl border p-4", isSelected ? "border-brand-navy" : "border-neutral-200")}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-label-md text-neutral-900">{characterLabel(character)}</p>
        {isSelected && (
          <span className="flex items-center gap-1 text-label-sm text-brand-navy">
            <Check className="size-3.5" /> Selected
          </span>
        )}
      </div>

      {character.variationAssetIds.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {character.variationAssetIds.map((assetId) => {
            const chosen = character.selectedVariationAssetId === assetId;
            const selecting = busy === "select";
            return (
              <button
                key={assetId}
                type="button"
                disabled={isSelected || busy !== null}
                onClick={() => selectVariation(assetId)}
                aria-label={chosen ? "Selected variation" : "Select this variation"}
                className={cn(
                  "relative aspect-square overflow-hidden rounded-lg border transition-opacity",
                  chosen ? "border-brand-navy ring-2 ring-brand-navy" : "border-neutral-200",
                  busy !== null && !isSelected && "opacity-50",
                  !isSelected && "cursor-pointer hover:border-brand-navy/50"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={assetUrlById[assetId]} alt="Character variation" className="size-full object-cover" />
                {chosen && (
                  <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-brand-navy text-white">
                    <Check className="size-3" />
                  </span>
                )}
                {selecting && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Loader2 className="size-5 animate-spin text-white" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : character.faceUploadFrontAssetId ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="aspect-square overflow-hidden rounded-lg border border-neutral-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={assetUrlById[character.faceUploadSideAssetId!]} alt="Side photo" className="size-full object-cover" />
          </div>
          <div className="aspect-square overflow-hidden rounded-lg border border-neutral-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={assetUrlById[character.faceUploadFrontAssetId]} alt="Front photo" className="size-full object-cover" />
          </div>
        </div>
      ) : (
        <div className="flex aspect-[2/1] items-center justify-center rounded-lg border border-dashed border-neutral-300 text-body-sm text-neutral-400">
          No photos yet
        </div>
      )}

      {!isSelected && (
        <div className="mt-3 flex flex-col gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={generateVariations}>
            {busy === "variations" ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            {character.variationAssetIds.length > 0 ? "Regenerate variations" : "Generate 2 AI variations"}
          </Button>

          <div className="flex gap-2">
            <label
              className={cn(
                "flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-label-sm text-neutral-600",
                busy !== null && "pointer-events-none opacity-60"
              )}
            >
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadPhoto(f, "side");
                }}
              />
              {busy === "upload-side" ? <Loader2 className="size-3.5 animate-spin" /> : <UploadCloud className="size-3.5" />}
              {sideAssetId ? "Side photo ✓" : "Side photo"}
            </label>
            <label
              className={cn(
                "flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-label-sm text-neutral-600",
                busy !== null && "pointer-events-none opacity-60"
              )}
            >
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadPhoto(f, "front");
                }}
              />
              {busy === "upload-front" ? <Loader2 className="size-3.5 animate-spin" /> : <UploadCloud className="size-3.5" />}
              {frontAssetId ? "Front photo ✓" : "Front photo"}
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

function SheetStep({
  projectId,
  characters,
  assetUrlById,
  onChanged,
}: {
  projectId: string;
  characters: FilmFlowCharacter[];
  assetUrlById: Record<string, string>;
  onChanged: () => void;
}) {
  const [busyId, setBusyId] = React.useState<string | null>(null);

  async function generateSheet(characterId: string) {
    setBusyId(characterId);
    const { ok, data, message } = await postJson(`/api/videos/film/${projectId}/characters/${characterId}/sheet`);
    if (!ok) {
      toast.error(message ?? "Couldn't generate the character sheet.");
    } else if ((data as { isMockFallback?: boolean } | undefined)?.isMockFallback) {
      // Same "flower" lesson this whole codebase already learned — a
      // mock-served placeholder must never look identical to a real result.
      toast.warning("This character sheet came from a mock placeholder, not a real analysis — every real provider was unavailable or the reference photo couldn't be fetched.");
    }
    setBusyId(null);
    onChanged();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-heading-3 text-neutral-900">Character sheets</h2>
        <p className="mt-1 text-body-sm text-neutral-500">
          The photo is what actually keeps each character&apos;s face consistent from scene to
          scene — every scene conditions on it directly. The written details below are
          supplementary context for the prompt, not a substitute for the photo.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {characters.map((c) => {
          const referenceAssetId = resolveFilmCharacterReferenceAssetId(c);
          const ready = c.status === "SHEET_READY";
          return (
            <div key={c.id} className="rounded-xl border border-neutral-200 p-4">
              <div className="flex gap-4">
                <div className="shrink-0">
                  {referenceAssetId ? (
                    <div className="w-28 overflow-hidden rounded-lg border-2 border-brand-navy">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={assetUrlById[referenceAssetId]}
                        alt={`${characterLabel(c)} — identity anchor photo`}
                        className="aspect-square size-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-square w-28 items-center justify-center rounded-lg border border-dashed border-neutral-300 text-label-sm text-neutral-400">
                      No photo
                    </div>
                  )}
                  <p className="mt-1 text-center text-label-sm text-neutral-400">Identity anchor</p>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-label-md text-neutral-900">{characterLabel(c)}</p>
                  {ready ? (
                    <p className="mt-0.5 text-label-sm text-brand-navy">Sheet ready</p>
                  ) : (
                    <p className="mt-0.5 text-label-sm text-neutral-400">Not generated yet</p>
                  )}

                  {ready && c.characterSheet && (
                    <>
                      <p className="mt-3 text-label-sm text-neutral-400">Details (supplementary)</p>
                      <dl className="mt-1 flex flex-col gap-1 text-body-sm text-neutral-600">
                        {Object.entries(c.characterSheet).map(([k, v]) => (
                          <div key={k}>
                            <dt className="inline text-neutral-400">{k}: </dt>
                            <dd className="inline">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    </>
                  )}

                  {!ready && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      disabled={busyId !== null}
                      onClick={() => generateSheet(c.id)}
                    >
                      {busyId === c.id ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                      Generate character sheet
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StoryboardStep({ projectId, onChanged }: { projectId: string; onChanged: () => void }) {
  const [busy, setBusy] = React.useState(false);

  async function generate() {
    setBusy(true);
    const { ok, message } = await postJson(`/api/videos/film/${projectId}/storyboard`);
    if (!ok) toast.error(message ?? "Couldn't generate the storyboard.");
    setBusy(false);
    onChanged();
  }

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-neutral-300 py-16 text-center">
      <FilmIcon className="size-8 text-neutral-300" />
      <div>
        <p className="text-label-md text-neutral-900">Every character is ready</p>
        <p className="mt-1 text-body-sm text-neutral-500">
          Plan the film into scenes — 8-12 seconds each, tagged with which character features in each one.
        </p>
      </div>
      <Button type="button" variant="primary" size="default" disabled={busy} onClick={generate}>
        {busy && <Loader2 className="size-4 animate-spin" />}
        <Sparkles className="size-4" />
        Generate storyboard
      </Button>
    </div>
  );
}

function ScenesStep({
  projectId,
  scenes,
  characters,
  onChanged,
}: {
  projectId: string;
  scenes: FilmFlowScene[];
  characters: FilmFlowCharacter[];
  onChanged: () => void;
}) {
  const characterById = React.useMemo(() => new Map(characters.map((c) => [c.id, c])), [characters]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-heading-3 text-neutral-900">Scene generation</h2>
        <p className="mt-1 text-body-sm text-neutral-500">
          Each scene conditions on its character&apos;s own stored photo (reference-image anchoring) —
          the same photo every time, not a chain from the previous scene. Watch each clip once it&apos;s
          ready — AI video is roughly 1-in-4 keeper quality, so regenerate any scene you&apos;re not happy
          with before merging, rather than living with it in the final film.
        </p>
      </div>
      <div className="flex flex-col gap-4">
        {scenes.map((scene) => {
          const character = scene.filmCharacterId ? characterById.get(scene.filmCharacterId) : null;
          return (
            <div key={scene.id} className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-4 sm:flex-row sm:items-start">
              <div className="flex items-start gap-3 sm:flex-1">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-label-sm text-neutral-600">
                  {scene.order + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm text-neutral-700">{scene.prompt}</p>
                  <div className="mt-1.5 flex items-center gap-3 text-label-sm text-neutral-400">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3.5" /> {scene.durationSeconds}s
                    </span>
                    {character && <span>{characterLabel(character)}</span>}
                  </div>
                  {scene.status === "FAILED" && scene.errorMessage && (
                    <p className="mt-1.5 text-label-sm text-error">{scene.errorMessage}</p>
                  )}
                </div>
              </div>

              {scene.status === "COMPLETED" && scene.videoUrl && (
                <video
                  controls
                  src={scene.videoUrl}
                  className="aspect-[9/16] w-full max-w-[140px] shrink-0 rounded-lg border border-neutral-200 bg-black object-cover sm:w-32"
                />
              )}

              <div className="shrink-0">
                <SceneGenerateButton projectId={projectId} sceneId={scene.id} sceneStatus={scene.status} onChanged={onChanged} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SceneGenerateButton({
  projectId,
  sceneId,
  sceneStatus,
  onChanged,
}: {
  projectId: string;
  sceneId: string;
  sceneStatus: SceneStatus;
  onChanged: () => void;
}) {
  const [busy, setBusy] = React.useState(false);

  async function generate() {
    setBusy(true);
    const { ok, data, message } = await postJson(`/api/videos/film/${projectId}/scenes/${sceneId}/generate`);
    if (!ok) {
      toast.error(message ?? "Couldn't generate this scene.");
    } else if ((data as { isMockFallback?: boolean } | undefined)?.isMockFallback) {
      // Same "flower" lesson this whole codebase already learned — a
      // mock-served placeholder must never look identical to a real result.
      toast.warning("This scene rendered as a mock placeholder, not a real video — every real provider was unavailable.");
    } else {
      toast.success("Scene generated.");
    }
    setBusy(false);
    onChanged();
  }

  const isDone = sceneStatus === "COMPLETED";

  // A completed scene stays clickable — "Regenerate" is the whole point:
  // ~1-in-4 real Veo clips are keepers, so re-rolling one bad scene before
  // merging has to be cheap to reach, not locked behind a disabled button.
  // Still labeled honestly: this is a real Veo call (quota today, credits
  // once film pricing is real), replacing the existing clip, not a free action.
  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={generate}>
        {busy && <Loader2 className="size-3.5 animate-spin" />}
        {isDone ? "Regenerate scene" : sceneStatus === "FAILED" ? "Retry" : "Generate scene"}
      </Button>
      {isDone && <span className="text-label-sm text-neutral-400">Uses a real Veo call — replaces this clip</span>}
    </div>
  );
}

function MergeStep({ projectId, onChanged }: { projectId: string; onChanged: () => void }) {
  const [busy, setBusy] = React.useState(false);

  async function merge() {
    setBusy(true);
    const { ok, message } = await postJson(`/api/videos/film/${projectId}/merge`);
    if (!ok) toast.error(message ?? "Couldn't merge the film.");
    setBusy(false);
    onChanged();
  }

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-neutral-300 py-16 text-center">
      <FilmIcon className="size-8 text-neutral-300" />
      <div>
        <p className="text-label-md text-neutral-900">Every scene is generated</p>
        <p className="mt-1 text-body-sm text-neutral-500">Merge them into the final film.</p>
      </div>
      <Button type="button" variant="primary" size="default" disabled={busy} onClick={merge}>
        {busy && <Loader2 className="size-4 animate-spin" />}
        <Sparkles className="size-4" />
        Merge film
      </Button>
    </div>
  );
}

function DoneStep({ videoUrl }: { videoUrl: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-5 py-6 text-center">
      <h2 className="text-heading-2 text-neutral-900">Your film is ready</h2>
      <video controls src={videoUrl} className="w-full max-w-xs rounded-xl border border-neutral-200 bg-black" />
    </div>
  );
}
