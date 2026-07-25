import { AdminConfigForm } from "@/components/admin/admin-config-form";
import { CreativeToolsManager } from "./creative-tools-manager";

export default function AdminCreativeToolsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-heading-2 text-neutral-900">Creative Tools</h1>
        <p className="mt-1 text-body-sm text-neutral-500">
          Every Dashboard card, quick action, and coming-soon stub — labels, icons, gradients, credit
          cost, prompt prefix, default AI provider, ordering, and enable/disable. Changes here take
          effect immediately, no deployment required.
        </p>
      </div>
      <CreativeToolsManager />
      <AdminConfigForm sections={[{ category: "dashboard_content", title: "Dashboard — Inspiration library" }]} />
    </div>
  );
}
