import { AssetLibraryManager } from "./asset-library-manager";

export default function AdminAssetLibraryPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-heading-2 text-neutral-900">Asset Library</h1>
        <p className="mt-1 text-body-sm text-neutral-500">
          Bulk-upload curated static content (Mixkit/Freesound/Flaticon downloads, or anything
          manually sourced) — tagged by category, available to every user/project once uploaded.
          Separate from live provider search (Pexels/Pixabay/LottieFiles/icons — configured under{" "}
          <a href="/admin/ai-providers" className="underline">
            AI Providers
          </a>
          ).
        </p>
      </div>
      <AssetLibraryManager />
    </div>
  );
}
