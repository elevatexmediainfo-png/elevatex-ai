"use client";

import { Eye, EyeOff, Plus, Trash2, Volume2, VolumeX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TRACK_KINDS, useEditor } from "./editor-types";

// Layers panel — lists every layer/track on the project (Video, Images,
// Text, Captions, Stickers, Audio, Background Music) and lets the user
// add a new one of any kind, or mute/hide/remove an existing one. The
// Timeline's own track-row headers expose the same mute/hide toggles for
// quick access while editing; this panel is the overview + "add layer".
export function LayersPanel() {
  const { tracks, addTrack, removeTrack, updateTrack, moveTrack } = useEditor();
  const ordered = [...tracks].sort((a, b) => a.order - b.order);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-label-md text-neutral-700">Layers</p>
        <p className="mt-1 text-body-sm text-neutral-500">{ordered.length} layer{ordered.length === 1 ? "" : "s"}</p>
      </div>

      <div className="flex flex-col gap-2">
        {ordered.map((track) => (
          <div key={track.id} className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2">
            <p className="text-label-sm text-neutral-800">{track.kind}</p>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => moveTrack(track.id, "UP")}
                disabled={track.order === ordered[0]?.order}
                title="Move layer up"
              >
                ▲
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => moveTrack(track.id, "DOWN")}
                disabled={track.order === ordered[ordered.length - 1]?.order}
                title="Move layer down"
              >
                ▼
              </Button>
              {(track.kind === "AUDIO" || track.kind === "MUSIC") && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => updateTrack(track.id, { isMuted: !track.isMuted })}
                  title={track.isMuted ? "Unmute" : "Mute"}
                >
                  {track.isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => updateTrack(track.id, { isHidden: !track.isHidden })}
                title={track.isHidden ? "Show" : "Hide"}
              >
                {track.isHidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeTrack(track.id)} title="Remove layer">
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div>
        <p className="text-label-sm text-neutral-700">Add layer</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {TRACK_KINDS.map((kind) => (
            <Button key={kind} type="button" variant="chip" size="chip" onClick={() => addTrack(kind)}>
              <Plus className="size-3.5" /> {kind}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
