import { LabPanel } from "./lab-panel";

export default function AdminPromptLabPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-heading-2 text-neutral-900">Image Benchmark & Prompt Lab</h1>
        <p className="mt-1 text-body-sm text-neutral-500">
          Run any idea through the full AI-OS pipeline and compare 4 prompt variants — Balanced, Story-first,
          Composition-first, and Marketing-first — side-by-side. Rate each image across 8 commercial dimensions
          and save the winner to your training dataset. Admin-only. No credits consumed.
        </p>
      </div>
      <LabPanel />
    </div>
  );
}
