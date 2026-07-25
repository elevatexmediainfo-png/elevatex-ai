"use client";

import * as React from "react";
import { ArrowLeft, Bookmark, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "../shared/empty-state";
import { AssetGrid } from "../shared/asset-grid";
import { useQuickAddToTimeline } from "../shared/use-quick-add";
import {
  useAddAssetToCollectionMutation,
  useCollectionAssetsQuery,
  useCollectionsQuery,
  useCreateCollectionMutation,
  useDeleteCollectionMutation,
  useEditorAssetsQuery,
  useRemoveAssetFromCollectionMutation,
} from "../../queries";
import type { GridAssetItem } from "../types";

const SWATCH_FALLBACK = "bg-neutral-700/40";

// Module 11 — Part D: user-created named groups of assets. Two-pane: a
// list of collections (create/delete), drilling into one to browse/add/
// remove its assets. Deliberately no rename affordance yet (not in the
// verification list — create, add an asset, confirm it appears — kept
// this UI to exactly that scope rather than building unused CRUD).
export function CollectionsSection() {
  const [activeCollectionId, setActiveCollectionId] = React.useState<string | null>(null);
  const { data: collections, isLoading } = useCollectionsQuery();
  const createCollection = useCreateCollectionMutation();
  const deleteCollection = useDeleteCollectionMutation();
  const [newName, setNewName] = React.useState("");

  const activeCollection = collections?.find((c) => c.id === activeCollectionId) ?? null;

  if (activeCollectionId && activeCollection) {
    return (
      <CollectionDetail
        collectionId={activeCollectionId}
        collectionName={activeCollection.name}
        onBack={() => setActiveCollectionId(null)}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-2 border-b border-editor-line p-3">
        <h2 className="text-label-sm text-neutral-200">Collections</h2>
        <div className="flex items-center gap-1.5">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New collection name…"
            className="h-8 border-editor-line bg-editor-surface-1 text-body-sm text-neutral-100 placeholder:text-neutral-500"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim()) {
                createCollection.mutate(newName.trim());
                setNewName("");
              }
            }}
          />
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            disabled={!newName.trim() || createCollection.isPending}
            onClick={() => {
              createCollection.mutate(newName.trim());
              setNewName("");
            }}
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        {isLoading ? (
          <p className="p-4 text-caption text-neutral-500">Loading…</p>
        ) : !collections || collections.length === 0 ? (
          <EmptyState icon={Bookmark} title="No collections yet" description="Group saved assets into collections to reuse across projects." />
        ) : (
          <div className="flex flex-col divide-y divide-white/5 p-1">
            {collections.map((c) => (
              <div key={c.id} className="group flex items-center gap-2.5 rounded-md px-2 py-2 hover:bg-editor-surface-1">
                <button type="button" onClick={() => setActiveCollectionId(c.id)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-body-sm text-neutral-200">{c.name}</p>
                  <p className="text-caption text-neutral-500">{c.assetCount} item{c.assetCount === 1 ? "" : "s"}</p>
                </button>
                <button
                  type="button"
                  onClick={() => deleteCollection.mutate(c.id)}
                  className="hidden shrink-0 rounded-full p-1 text-neutral-400 hover:text-editor-danger group-hover:block"
                  title="Delete collection"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CollectionDetail({
  collectionId,
  collectionName,
  onBack,
}: {
  collectionId: string;
  collectionName: string;
  onBack: () => void;
}) {
  const { data: assets, isLoading } = useCollectionAssetsQuery(collectionId);
  const removeAsset = useRemoveAssetFromCollectionMutation();
  const addAsset = useAddAssetToCollectionMutation();
  const { addAsset: quickAdd } = useQuickAddToTimeline();
  const userAssetsQuery = useEditorAssetsQuery();
  const [pickerAssetId, setPickerAssetId] = React.useState<string>("");

  const items: GridAssetItem[] = (assets ?? []).map((a) => ({
    id: a.id,
    label: a.originalFilename,
    swatch: SWATCH_FALLBACK,
    previewUrl: a.kind === "IMAGE" ? a.url : undefined,
    assetId: a.id,
    kind: a.kind,
    durationMs: a.durationSeconds ? Math.round(a.durationSeconds * 1000) : undefined,
  }));

  const assetIdsInCollection = new Set((assets ?? []).map((a) => a.id));
  const availableToAdd = (userAssetsQuery.data ?? []).filter((a) => !assetIdsInCollection.has(a.id));

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-2 border-b border-editor-line p-3">
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-caption text-neutral-400 hover:text-white">
          <ArrowLeft className="size-3.5" /> Collections
        </button>
        <h2 className="text-label-sm text-neutral-200">{collectionName}</h2>
        {availableToAdd.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Select value={pickerAssetId} onValueChange={setPickerAssetId}>
              <SelectTrigger className="h-8 flex-1">
                <SelectValue placeholder="Add an asset…" />
              </SelectTrigger>
              <SelectContent>
                {availableToAdd.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.originalFilename}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="secondary"
              size="icon-sm"
              disabled={!pickerAssetId}
              onClick={() => {
                addAsset.mutate({ collectionId, assetId: pickerAssetId });
                setPickerAssetId("");
              }}
            >
              <Plus className="size-4" />
            </Button>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        {isLoading ? (
          <p className="p-4 text-caption text-neutral-500">Loading…</p>
        ) : items.length === 0 ? (
          <EmptyState icon={Bookmark} title="No assets in this collection" description="Add an asset above to get started." />
        ) : (
          <AssetGrid
            items={items}
            onAdd={(item) => quickAdd(item, item.label)}
            onRemove={(item) => item.assetId && removeAsset.mutate({ collectionId, assetId: item.assetId })}
          />
        )}
      </div>
    </div>
  );
}
