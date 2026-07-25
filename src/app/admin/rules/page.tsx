import { RulesForm } from "./rules-form";

export default function AdminRulesPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-heading-2 text-neutral-900">Download Rules</h1>
        <p className="mt-1 text-body-sm text-neutral-500">
          Changes take effect within ~30 seconds (the config cache TTL) — no deploy needed. For what
          gets deducted from a user&apos;s credit balance, see Credit Rates instead.
        </p>
      </div>
      <RulesForm />
    </div>
  );
}
