"use client";

import * as React from "react";
import type { MotionKeyframe } from "@/lib/motion/engine";

// Shared types + context for the Video Editor (Milestone 9). One context
// instead of prop-drilling every mutation handler through six sibling
// panels (Layers/Text/Captions/Media/AI/Export) — each panel calls
// useEditor() and reads/mutates the same state the Timeline and Scene
// Preview already share.

export interface ProjectView {
  id: string;
  title: string;
  status: string;
  aspectRatio: "RATIO_9_16" | "RATIO_1_1" | "RATIO_16_9";
  durationSeconds: number | null;
}

export interface SceneView {
  id: string;
  order: number;
  status: string;
  prompt: string;
  imagePrompt: string | null;
  videoPrompt: string | null;
  durationSeconds: number;
  videoUrl: string | null;
  imageUrl: string | null;
  voiceUrl: string | null;
  backgroundMusicUrl: string | null;
  subtitleText: string | null;
  errorMessage: string | null;
}

export const TRACK_KINDS = ["VIDEO", "IMAGE", "TEXT", "CAPTION", "STICKER", "AUDIO", "MUSIC"] as const;
export type TrackKind = (typeof TRACK_KINDS)[number];

export interface TrackView {
  id: string;
  videoProjectId: string;
  kind: TrackKind;
  order: number;
  isMuted: boolean;
  isHidden: boolean;
}

export interface ClipContent {
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: string;
  textAlign?: "left" | "center" | "right";
  lineHeight?: number;
  letterSpacing?: number;
  color?: string;
  gradientStartColor?: string;
  gradientEndColor?: string;
  gradientAngle?: number;
  backgroundColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  glowColor?: string;
  glowIntensity?: number;
  glowSpread?: number;
  animation?: string;
  x?: number;
  y?: number;
  scale?: number;
  rotation?: number;
  captionBlockId?: string;
  motionPresetId?: string;
  motionKeyframes?: MotionKeyframe[];
  [key: string]: unknown;
}

export interface ClipView {
  id: string;
  trackId: string;
  videoProjectId: string;
  sceneId: string | null;
  assetId: string | null;
  startMs: number;
  durationMs: number;
  trimStartMs: number;
  content: ClipContent | null;
}

export interface FontOption {
  id: string;
  label: string;
  family: string;
}

export interface StylePreset {
  id: string;
  label: string;
  style: Record<string, unknown>;
}

export interface VoiceOption {
  id: string;
  label: string;
  gender: "MALE" | "FEMALE" | "NEUTRAL";
}

export interface MusicOption {
  id: string;
  label: string;
  url: string;
}

export interface StockOption {
  id: string;
  label: string;
  kind: "IMAGE" | "VIDEO" | "STICKER";
  url: string;
}

export interface AssetView {
  id: string;
  kind: "IMAGE" | "VIDEO" | "VOICE" | "STICKER";
  source: "AI_GENERATED" | "UPLOAD" | "STOCK" | "BRAND";
  url: string;
  label: string | null;
  createdAt: string;
}

export type RightPanelTab = "layers" | "text" | "motion" | "captions" | "media" | "ai" | "export";
export type TrackMoveDirection = "UP" | "DOWN";

export interface EditorContextValue {
  project: ProjectView;
  scenes: SceneView[];
  patchScene: (sceneId: string, patch: Partial<SceneView>) => void;
  tracks: TrackView[];
  clips: ClipView[];
  selectedClipId: string | null;
  setSelectedClipId: (id: string | null) => void;
  playheadMs: number;
  setPlayheadMs: React.Dispatch<React.SetStateAction<number>>;
  playing: boolean;
  setPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  pxPerSecond: number;
  setPxPerSecond: (n: number) => void;
  rightTab: RightPanelTab;
  setRightTab: (tab: RightPanelTab) => void;

  fonts: FontOption[];
  textPresets: StylePreset[];
  captionPresets: StylePreset[];
  voices: VoiceOption[];
  music: MusicOption[];
  stock: StockOption[];
  assets: AssetView[];
  refreshAssets: () => void;

  addTrack: (kind: TrackKind) => Promise<TrackView | null>;
  removeTrack: (trackId: string) => Promise<void>;
  updateTrack: (trackId: string, patch: { isMuted?: boolean; isHidden?: boolean }) => Promise<void>;
  moveTrack: (trackId: string, direction: TrackMoveDirection) => Promise<void>;
  addClip: (input: {
    trackId: string;
    sceneId?: string;
    assetId?: string;
    startMs: number;
    durationMs: number;
    content?: ClipContent;
  }) => Promise<ClipView | null>;
  updateClip: (clipId: string, patch: Partial<Pick<ClipView, "trackId" | "startMs" | "durationMs" | "trimStartMs" | "content">>) => Promise<void>;
  deleteClip: (clipId: string) => Promise<void>;
  splitClip: (clipId: string, offsetMs: number) => Promise<void>;
  mergeClips: (clipId: string, withClipId: string) => Promise<void>;
  duplicateClip: (clipId: string) => Promise<void>;

  sceneById: Map<string, SceneView>;
  assetById: Map<string, AssetView>;
  totalDurationMs: number;
}

export const EditorContext = React.createContext<EditorContextValue | null>(null);

export function useEditor(): EditorContextValue {
  const ctx = React.useContext(EditorContext);
  if (!ctx) throw new Error("useEditor() must be used within the Video Editor.");
  return ctx;
}

export function clipEndMs(clip: ClipView): number {
  return clip.startMs + clip.durationMs;
}

export function formatTimecode(ms: number): string {
  const totalSeconds = Math.max(0, ms) / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const frames = Math.floor((totalSeconds % 1) * 100);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(frames).padStart(2, "0")}`;
}
