import { redirect } from "next/navigation";
import { FileImage, FileVideo, Mic, Sticker } from "lucide-react";

import { auth } from "@/lib/auth";
import { Container } from "@/components/shared/container";
import { listAssets, type AssetKindValue } from "@/lib/assets/service";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";

const KIND_OPTIONS: { value: AssetKindValue | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "IMAGE", label: "Images" },
  { value: "VIDEO", label: "Videos" },
  { value: "VOICE", label: "Voice" },
  { value: "STICKER", label: "Stickers" },
];

const KIND_ICON: Record<AssetKindValue, typeof FileImage> = {
  IMAGE: FileImage,
  VIDEO: FileVideo,
  VOICE: Mic,
  STICKER: Sticker,
};

// Media Library — every Asset the user owns (AI-generated and uploaded
// alike), reusing the same listAssets() the rest of the app already uses,
// not a second query path.
export default async function MediaLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { kind } = await searchParams;
  const activeKind = (kind && KIND_OPTIONS.some((o) => o.value === kind) ? kind : "ALL") as AssetKindValue | "ALL";

  const assets = await listAssets(session.user.id, activeKind === "ALL" ? undefined : activeKind, 200);

  return (
    <Container className="flex flex-col gap-6 py-10">
      <div>
        <h1 className="text-heading-1 text-neutral-900">Assets</h1>
        <p className="mt-1 text-body-md text-neutral-500">Your Media Library — every image, video, voice clip, and sticker.</p>
      </div>

      <div className="flex gap-2">
        {KIND_OPTIONS.map((o) => (
          <a
            key={o.value}
            href={o.value === "ALL" ? "/media-library" : `/media-library?kind=${o.value}`}
            className={cn(
              "rounded-full border px-3 py-1.5 text-label-sm transition-colors",
              activeKind === o.value ? "border-brand-navy bg-brand-navy-light text-brand-navy" : "border-neutral-300 text-neutral-600 hover:border-brand-navy/40"
            )}
          >
            {o.label}
          </a>
        ))}
      </div>

      {assets.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-neutral-300 bg-white py-16 text-center">
          <FileImage className="size-8 text-neutral-300" />
          <p className="text-body-md text-neutral-500">Nothing here yet — generated and uploaded assets will show up in this library.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {assets.map((a) => {
            const Icon = KIND_ICON[a.kind];
            return (
              <div key={a.id} className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                <div className="flex aspect-square items-center justify-center bg-neutral-100">
                  {a.kind === "IMAGE" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.url} alt={a.label ?? ""} className="size-full object-cover" />
                  ) : (
                    <Icon className="size-6 text-neutral-300" />
                  )}
                </div>
                <div className="p-2">
                  <p className="truncate text-label-sm text-neutral-900">{a.label ?? a.kind}</p>
                  <p className="text-body-sm text-neutral-500">{formatDate(a.createdAt)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Container>
  );
}
