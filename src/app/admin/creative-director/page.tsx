import { CDDebugPanel } from "./cd-debug";

export default function AdminCreativeDirectorPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-heading-2 text-neutral-900">Creative Director Debug</h1>
        <p className="mt-1 text-body-sm text-neutral-500">
          Run the complete 5-stage pipeline against any idea: Creative Brain → GPT Creative Director → Prompt Specification → Provider Prompt → Image placeholder.
          Shows the GPT narrative prompt, quality validation (7 checks), final OpenAI prompt, and all intermediate debug data.
          No credits consumed. Admin-only.
        </p>
      </div>
      <CDDebugPanel />
    </div>
  );
}
