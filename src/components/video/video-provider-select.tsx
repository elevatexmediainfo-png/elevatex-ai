"use client";

import * as React from "react";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface VideoProviderOption {
  id: string;
  label: string;
  credits: number;
}

// Shared across every real user-facing video-generation flow (Quick Video,
// GENERATED, FILM, Marketing Templates VIDEO) so the fetch-enabled-
// providers + default-selection logic lives in exactly one place. Always
// queries live (never a hardcoded provider list) — a provider disabled in
// Admin stops appearing on the next fetch automatically.
export function useVideoProviders(baseCredits: number) {
  const [providers, setProviders] = React.useState<VideoProviderOption[] | null>(null);
  const [selected, setSelected] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/videos/providers?baseCredits=${baseCredits}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled || !json.success) return;
        setProviders(json.data.providers);
        setSelected((prev) => prev ?? json.data.defaultProviderId ?? undefined);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [baseCredits]);

  const selectedCredits = providers?.find((p) => p.id === selected)?.credits ?? baseCredits;

  return { providers, selected, setSelected, selectedCredits };
}

// Sensible default: the fetch above already returns the admin's current
// top-priority enabled provider as defaultProviderId, pre-selected — an
// opt-in control, not a forced decision every time. Renders nothing when
// there are 0-1 enabled providers (nothing real to choose between yet).
export function VideoProviderSelect({
  providers,
  value,
  onChange,
  label = "Video provider",
  labelClassName = "text-neutral-700",
}: {
  providers: VideoProviderOption[] | null;
  value: string | undefined;
  onChange: (id: string) => void;
  label?: string;
  labelClassName?: string;
}) {
  if (!providers || providers.length < 2) return null;

  return (
    <div>
      <Label className={`mb-1.5 block text-label-sm ${labelClassName}`}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-10 w-full max-w-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {providers.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.label} — {p.credits} credit{p.credits === 1 ? "" : "s"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// Compares what the user asked for against who actually served the
// request (VideoRenderResultWithProvider.providerId) — the "with a notice"
// half of the founder-confirmed fallback behavior. Returns null when they
// match (no notice needed) or no provider was explicitly requested.
export function fallbackNoticeText(
  requestedProviderId: string | undefined,
  actualProviderId: string,
  providers: VideoProviderOption[] | null
): string | null {
  if (!requestedProviderId || requestedProviderId === actualProviderId) return null;
  const requestedLabel = providers?.find((p) => p.id === requestedProviderId)?.label ?? requestedProviderId;
  const actualLabel = providers?.find((p) => p.id === actualProviderId)?.label ?? actualProviderId;
  return `${requestedLabel} was unavailable, so this was generated with ${actualLabel} instead.`;
}
