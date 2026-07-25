"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, UploadCloud, Check, Film as FilmIcon, Clock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Container } from "@/components/shared/container";
import { cn } from "@/lib/utils";
import { putWithProgress } from "@/lib/upload/put-with-progress";
import { resolveFilmCharacterReferenceAssetId, type FilmBrief } from "@/lib/film/types";
import { useVideoProviders, VideoProviderSelect } from "@/components/video/video-provider-select";

const FILM_SCENE_BASE_CREDITS = 131; // VIDEO_ACTION_CREDIT_COSTS.film_scene's current default — the selector shows each real provider's actual resolved cost, this is only the pre-fetch placeholder shown before the live list loads.

type FilmCharacterStatus = "PENDING" | "GENERATING_VARIATIONS" | "VARIATIONS_READY" | "FACE_UPLOADED" | "SELECTED" | "SHEET_READY";
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
  /** A real, cheap image shown before the user commits to video generation — null when preview generation degraded gracefully (real provider outage, etc.), same "text-only" fallback as before this feature existed. */
  previewImageUrl: string | null;
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
//
// Real bug fix (2026-07-25, found during the FILM stuck-generation audit) —
// this fetch had NO timeout at all: a genuinely hung backend request (the
// exact class of bug this same audit found and fixed in toBuffer()/
// uploadFromUrl() — a raw fetch with no timeout downloading a finished
// video/voice clip) meant this promise would never resolve, `busy` would
// never flip back to false, and the button would show "Generating…"
// literally forever — indistinguishable from a real hang even after the
// backend eventually recovers. 45 minutes — generous enough to never
// false-positive on this file's own legitimately slowest real action
// (MergeStep's own comment: "usually takes 20-40 minutes for a multi-scene
// film"), while still bounding what used to be an unbounded wait.
const REQUEST_TIMEOUT_MS = 45 * 60 * 1000;

async function postJson(url: string, body?: unknown) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const json = await res.json();
    return { ok: json.success as boolean, data: json.data, message: json.error?.message as string | undefined };
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return {
      ok: false,
      data: undefined,
      message: timedOut
        ? "This is taking much longer than expected and may have stalled — please check back or try again."
        : "Network error. Please try again.",
    };
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy !== null || character.status === "GENERATING_VARIATIONS"}
            onClick={generateVariations}
          >
            {busy === "variations" || character.status === "GENERATING_VARIATIONS" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
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
          Plan the film into short, punchy scenes — 2-3 seconds each, fast-cut together, tagged with which character features in each one.
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

// Bulk-approve (2026-07-23) — the piece connecting character generation +
// storyboard review to actual video generation without a click per scene.
// Polls scenes/progress/route.ts while the one blocking generate-all POST
// is in flight, same real-progress-not-silent-wait pattern MergeStep
// already established for the (much longer) Merge step. Deliberately
// client-orchestrated against the SAME per-scene route the individual
// "Generate scene" button already uses (via generate-all's shared
// generateAndPersistFilmScene()) rather than a new job/queue table — FILM
// has no existing per-scene job infrastructure to plug into, and this
// keeps bulk-approve and single-scene generation permanently unable to
// drift apart.
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
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const [liveStatusById, setLiveStatusById] = React.useState<Record<string, { status: SceneStatus; errorMessage: string | null }>>({});
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);
  // One project-level choice, applies to both the bulk "Approve & generate
  // all" action and every individual per-scene Generate/Regenerate button —
  // FILM has no per-scene provider UI (would be one dropdown per scene row,
  // real clutter for no real benefit since a film's scenes are conditioned
  // consistently by design already).
  const { providers: videoProviders, selected: preferredProviderId, setSelected: setPreferredProviderId } =
    useVideoProviders(FILM_SCENE_BASE_CREDITS);

  // scenes stays frozen (the parent only re-renders it via onChanged()'s
  // router.refresh(), called once at the very end) for the whole bulk run,
  // so this target set is stable to track progress against even though
  // liveStatusById updates every poll.
  const targetSceneIds = React.useMemo(
    () => scenes.filter((s) => s.status === "DRAFT" || s.status === "FAILED").map((s) => s.id),
    [scenes]
  );

  React.useEffect(() => {
    if (!bulkBusy) return;
    const startedAt = Date.now();
    const elapsedTimer = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    const progressTimer = setInterval(async () => {
      try {
        const res = await fetch(`/api/videos/film/${projectId}/scenes/progress`);
        const json = await res.json();
        if (json.success) {
          const map: Record<string, { status: SceneStatus; errorMessage: string | null }> = {};
          for (const s of json.data.scenes as { id: string; status: SceneStatus; errorMessage: string | null }[]) {
            map[s.id] = { status: s.status, errorMessage: s.errorMessage };
          }
          setLiveStatusById(map);
        }
      } catch {
        // Best-effort — a missed poll just means the last-known state keeps showing until the next tick succeeds.
      }
    }, 3000);
    return () => {
      clearInterval(elapsedTimer);
      clearInterval(progressTimer);
    };
  }, [bulkBusy, projectId]);

  async function bulkApprove() {
    setBulkBusy(true);
    setElapsedSeconds(0);
    setLiveStatusById({});
    const { ok, data, message } = await postJson(`/api/videos/film/${projectId}/scenes/generate-all`, { preferredProviderId });
    if (!ok) {
      toast.error(message ?? "Couldn't start scene generation.");
    } else {
      const { completed, failed } = data as { completed: number; failed: number };
      if (failed === 0) {
        toast.success(`${completed} scene${completed === 1 ? "" : "s"} generated.`);
      } else {
        toast.warning(
          `${completed} scene${completed === 1 ? "" : "s"} generated, ${failed} failed — review and retry below.`
        );
      }
    }
    setBulkBusy(false);
    onChanged();
  }

  const targetTotal = targetSceneIds.length;
  const targetDoneCount = targetSceneIds.filter((sid) => {
    const live = liveStatusById[sid];
    return live && (live.status === "COMPLETED" || live.status === "FAILED");
  }).length;
  const progressPercent = targetTotal > 0 ? Math.round((targetDoneCount / targetTotal) * 100) : 0;
  const elapsedLabel = `${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, "0")}`;

  // Live poll data overlays the server-rendered scenes for display only —
  // videoUrl isn't part of the lightweight progress payload, so a scene's
  // preview clip still only appears after onChanged()'s refresh at the end,
  // same as how Merge doesn't show a live preview mid-render either.
  const displayScenes = scenes.map((s) => (liveStatusById[s.id] ? { ...s, ...liveStatusById[s.id] } : s));

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

      <VideoProviderSelect providers={videoProviders} value={preferredProviderId} onChange={setPreferredProviderId} label="Video provider (applies to every scene below)" />

      {targetTotal > 0 && (
        <div className="rounded-xl border border-dashed border-neutral-300 p-4">
          {!bulkBusy ? (
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-label-md text-neutral-900">
                  Ready to generate {targetTotal} scene{targetTotal === 1 ? "" : "s"}
                </p>
                <p className="mt-0.5 text-body-sm text-neutral-500">
                  Kicks off every remaining scene at once — you can still review and regenerate any scene
                  individually afterward.
                </p>
              </div>
              <Button type="button" variant="primary" size="default" onClick={bulkApprove}>
                <Sparkles className="size-4" />
                Approve storyboard &amp; generate all scenes
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin text-neutral-500" />
                <p className="text-label-md text-neutral-900">Generating scenes…</p>
              </div>
              <Progress value={progressPercent} />
              <p className="text-body-sm text-neutral-500">
                {targetDoneCount} of {targetTotal} done — {progressPercent}% — {elapsedLabel} elapsed
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {displayScenes.map((scene) => {
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
                    {scene.status === "RENDERING" && (
                      <span className="flex items-center gap-1 text-brand-navy">
                        <Loader2 className="size-3 animate-spin" /> Generating…
                      </span>
                    )}
                  </div>
                  {scene.status === "FAILED" && scene.errorMessage && (
                    <p className="mt-1.5 text-label-sm text-error">{scene.errorMessage}</p>
                  )}
                </div>
              </div>

              {scene.status === "COMPLETED" && scene.videoUrl ? (
                <video
                  controls
                  src={scene.videoUrl}
                  className="aspect-[9/16] w-full max-w-[140px] shrink-0 rounded-lg border border-neutral-200 bg-black object-cover sm:w-32"
                />
              ) : (
                scene.previewImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={scene.previewImageUrl}
                    alt={`Storyboard preview — scene ${scene.order + 1}`}
                    className="aspect-[9/16] w-full max-w-[140px] shrink-0 rounded-lg border border-neutral-200 bg-black object-cover sm:w-32"
                  />
                )
              )}

              <div className="shrink-0">
                <SceneGenerateButton
                  projectId={projectId}
                  sceneId={scene.id}
                  sceneStatus={scene.status}
                  disabled={bulkBusy}
                  preferredProviderId={preferredProviderId}
                  onChanged={onChanged}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface SceneRenderProgress {
  providerId: string;
  attempt: number;
  maxAttempts: number;
  phase: "attempt_start" | "attempt_failed" | "provider_exhausted";
  error?: string;
}

function describeSceneProgress(p: SceneRenderProgress | null): string | null {
  if (!p) return null;
  if (p.phase === "attempt_start") {
    return p.attempt > 1
      ? `${p.providerId}: attempt ${p.attempt} of ${p.maxAttempts} in progress…`
      : `${p.providerId}: rendering…`;
  }
  if (p.phase === "attempt_failed") {
    return p.attempt < p.maxAttempts
      ? `${p.providerId}: attempt ${p.attempt} failed, retrying…`
      : `${p.providerId}: attempt ${p.attempt} failed…`;
  }
  // provider_exhausted — every retry for this provider is spent; the engine
  // is about to move to the next one in the chain (or fail outright if this
  // was the last).
  return `${p.providerId} unavailable after ${p.attempt} attempt(s) — trying the next provider…`;
}

function SceneGenerateButton({
  projectId,
  sceneId,
  sceneStatus,
  disabled,
  preferredProviderId,
  onChanged,
}: {
  projectId: string;
  sceneId: string;
  sceneStatus: SceneStatus;
  disabled?: boolean;
  preferredProviderId?: string;
  onChanged: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);
  const [progress, setProgress] = React.useState<SceneRenderProgress | null>(null);

  // Real progress feedback (2026-07-25) — a real ~10-minute scene render (2
  // failed video-provider attempts + one timed-out retry, live-confirmed
  // during the investigation this fixes) used to show nothing but this
  // button's own spinner the whole time, indistinguishable from a hang.
  // Polls the new scenes/[sceneId]/progress endpoint concurrently with the
  // generate POST — same pattern as MergeStep's merge/progress polling
  // below, real elapsed time as the fallback for the gap before the first
  // attempt's progress write lands.
  React.useEffect(() => {
    if (!busy) return;
    const startedAt = Date.now();
    const elapsedTimer = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    const progressTimer = setInterval(async () => {
      try {
        // Real hygiene fix (2026-07-25, same audit as postJson's own
        // timeout above) — with no bound, a stalled poll response could sit
        // pending indefinitely while this interval keeps firing every 3s
        // regardless, silently accumulating hung requests for the entire
        // duration of a long generation. 10s is generous for a same-origin
        // DB read and short relative to the 3s poll cadence.
        const res = await fetch(`/api/videos/film/${projectId}/scenes/${sceneId}/progress`, {
          signal: AbortSignal.timeout(10_000),
        });
        const json = await res.json();
        if (json.success && json.data?.progress) setProgress(json.data.progress);
      } catch {
        // Best-effort — a missed poll just means the elapsed-time fallback
        // keeps showing until the next tick succeeds.
      }
    }, 3000);
    return () => {
      clearInterval(elapsedTimer);
      clearInterval(progressTimer);
    };
  }, [busy, projectId, sceneId]);

  async function generate() {
    setBusy(true);
    setElapsedSeconds(0);
    setProgress(null);
    // Fixed 2026-07-23 — a mock-fallback result is now a real API error
    // (ERR_MOCK_FALLBACK, the scene is marked FAILED server-side), not a
    // disguised success — the old isMockFallback-on-success branch here is
    // gone; this same !ok toast now covers that case with a clear message.
    const { ok, data, message } = await postJson(`/api/videos/film/${projectId}/scenes/${sceneId}/generate`, { preferredProviderId });
    if (!ok) {
      toast.error(message ?? "Couldn't generate this scene.");
    } else {
      const responseData = data as { providerId?: string; narrationSkippedReason?: string | null } | undefined;
      const actualProviderId = responseData?.providerId;
      if (preferredProviderId && actualProviderId && actualProviderId !== preferredProviderId) {
        toast.warning(`Your selected provider was unavailable — generated with a different one instead.`);
      } else if (responseData?.narrationSkippedReason) {
        // Real-resilience fix (2026-07-25) — voice failure no longer blocks
        // the whole scene, but that must stay visible, not silently absent.
        toast.warning("Scene generated without narration — no voice provider was reachable.");
      } else {
        toast.success("Scene generated.");
      }
    }
    setBusy(false);
    setProgress(null);
    onChanged();
  }

  const isDone = sceneStatus === "COMPLETED";
  const elapsedLabel = `${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, "0")}`;
  const progressLabel = describeSceneProgress(progress);

  // A completed scene stays clickable — "Regenerate" is the whole point:
  // ~1-in-4 real Veo clips are keepers, so re-rolling one bad scene before
  // merging has to be cheap to reach, not locked behind a disabled button.
  // Still labeled honestly: this is a real Veo call (quota today, credits
  // once film pricing is real), replacing the existing clip, not a free action.
  // Disabled while a bulk-approve run is in flight (`disabled` prop) — same
  // reasoning as generate-all's own server-side 409 guard: never let an
  // individual click double-dispatch a scene the batch is already working on.
  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="outline" size="sm" disabled={busy || disabled || sceneStatus === "RENDERING"} onClick={generate}>
        {busy && <Loader2 className="size-3.5 animate-spin" />}
        {isDone ? "Regenerate scene" : sceneStatus === "FAILED" ? "Retry" : "Generate scene"}
      </Button>
      {busy && (
        <span className="max-w-[220px] text-right text-label-sm text-neutral-400">
          {progressLabel ?? "Starting…"} · {elapsedLabel}
        </span>
      )}
      {isDone && !busy && <span className="text-label-sm text-neutral-400">Uses a real Veo call — replaces this clip</span>}
    </div>
  );
}

// Real incident (2026-07-23) — a 60s/5-scene film's Merge took 25-35
// minutes with this screen showing nothing but a spinning button, live-
// confirmed indistinguishable from a hang (an investigation into this
// exact wait almost concluded the endpoint was broken before it finally
// completed successfully). The merge POST itself is still one blocking
// call — real per-frame progress was already tracked on
// EditorExport.progress the whole time, just invisible here. Polls the
// new read-only .../merge/progress endpoint concurrently while the POST
// is in flight (merge-via-editor.ts's getMergeExportProgress(), same
// naming-convention lookup findInFlightMergeExport already used) to show
// a real percentage once the export row exists, with a real elapsed-time
// counter as an honest fallback for the first few seconds before it does.
function MergeStep({ projectId, onChanged }: { projectId: string; onChanged: () => void }) {
  const [busy, setBusy] = React.useState(false);
  const [progressPercent, setProgressPercent] = React.useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);

  React.useEffect(() => {
    if (!busy) return;
    const startedAt = Date.now();
    const elapsedTimer = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    const progressTimer = setInterval(async () => {
      try {
        const res = await fetch(`/api/videos/film/${projectId}/merge/progress`);
        const json = await res.json();
        if (json.success && json.data?.found) setProgressPercent(json.data.progress);
      } catch {
        // Best-effort — a missed poll just means the elapsed-time fallback
        // keeps showing until the next tick succeeds.
      }
    }, 4000);
    return () => {
      clearInterval(elapsedTimer);
      clearInterval(progressTimer);
    };
  }, [busy, projectId]);

  async function merge() {
    setBusy(true);
    setProgressPercent(null);
    setElapsedSeconds(0);
    const { ok, message } = await postJson(`/api/videos/film/${projectId}/merge`);
    if (!ok) toast.error(message ?? "Couldn't merge the film.");
    setBusy(false);
    onChanged();
  }

  const elapsedLabel = `${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, "0")}`;

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-neutral-300 py-16 text-center">
      <FilmIcon className="size-8 text-neutral-300" />
      {!busy ? (
        <>
          <div>
            <p className="text-label-md text-neutral-900">Every scene is generated</p>
            <p className="mt-1 text-body-sm text-neutral-500">Merge them into the final film.</p>
          </div>
          <Button type="button" variant="primary" size="default" onClick={merge}>
            <Sparkles className="size-4" />
            Merge film
          </Button>
        </>
      ) : (
        <div className="w-full max-w-xs space-y-3">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="size-4 animate-spin text-neutral-500" />
            <p className="text-label-md text-neutral-900">Merging your film…</p>
          </div>
          <Progress value={progressPercent ?? 0} />
          <p className="text-body-sm text-neutral-500">
            {progressPercent != null ? `${progressPercent}% — ` : ""}
            {elapsedLabel} elapsed
          </p>
          <p className="text-caption text-neutral-400">
            This usually takes 20-40 minutes for a multi-scene film. Please don&apos;t close this tab.
          </p>
        </div>
      )}
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
