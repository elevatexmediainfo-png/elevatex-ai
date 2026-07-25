import { AdminConfigForm } from "@/components/admin/admin-config-form";

import { PricingForm } from "./pricing-form";

export default function AdminPricingPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-heading-2 text-neutral-900">Pricing & Credits</h1>
        <p className="mt-1 text-body-sm text-neutral-500">
          Subscription plans and one-time credit packages — both monetization models, edited here,
          never hardcoded.
        </p>
      </div>
      <PricingForm />
      <AdminConfigForm sections={[{ category: "billing", title: "Billing & tax (GST invoices)" }]} />
    </div>
  );
}
