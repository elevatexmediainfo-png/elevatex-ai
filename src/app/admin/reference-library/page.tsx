import { ReferenceLibraryManager } from "./reference-library-manager";

export default function AdminReferenceLibraryPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-heading-2 text-neutral-900">Reference Library</h1>
        <p className="mt-1 text-body-sm text-neutral-500">
          Upload curated &quot;gold standard&quot; sample ads per industry. Each upload is
          automatically analyzed for style, layout, and composition. Part A: storage and
          analysis only — not yet used in poster generation.
        </p>
      </div>
      <ReferenceLibraryManager />
    </div>
  );
}
