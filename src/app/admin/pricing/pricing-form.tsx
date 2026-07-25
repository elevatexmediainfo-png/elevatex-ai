"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type BillingInterval = "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "YEARLY";

const BILLING_INTERVAL_LABELS: Record<BillingInterval, string> = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  HALF_YEARLY: "Half-yearly",
  YEARLY: "Yearly",
};

interface PricingPlan {
  id: string;
  name: string;
  slug: string;
  billingModel: "PAY_PER_DOWNLOAD" | "SUBSCRIPTION";
  priceInPaise: number;
  billingInterval: BillingInterval | null;
  trialDays: number;
  monthlyCredits: number;
  maxDownloadsPerMonth: number | null;
  isActive: boolean;
}

interface CreditPackage {
  id: string;
  name: string;
  creditAmount: number;
  priceInPaise: number;
  isActive: boolean;
}

function rupees(paise: number) {
  return (paise / 100).toFixed(2);
}

export function PricingForm() {
  const [plans, setPlans] = React.useState<PricingPlan[] | null>(null);
  const [packages, setPackages] = React.useState<CreditPackage[] | null>(null);
  const [newPackage, setNewPackage] = React.useState({ name: "", creditAmount: "", priceInPaise: "" });
  const [creating, setCreating] = React.useState(false);
  const [grantForm, setGrantForm] = React.useState({ identifiers: "", amount: "", description: "" });
  const [granting, setGranting] = React.useState(false);

  const loadAll = React.useCallback(async () => {
    const [plansRes, packagesRes] = await Promise.all([
      fetch("/api/admin/pricing-plans").then((r) => r.json()),
      fetch("/api/admin/credit-packages").then((r) => r.json()),
    ]);
    if (plansRes.success) setPlans(plansRes.data.plans);
    if (packagesRes.success) setPackages(packagesRes.data.packages);
  }, []);

  React.useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function patchPlan(id: string, data: Record<string, unknown>) {
    const res = await fetch(`/api/admin/pricing-plans/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) {
      toast.error(json.error?.message ?? "Couldn't save plan.");
      return;
    }
    toast.success("Plan updated.");
    await loadAll();
  }

  async function patchPackage(id: string, data: Record<string, unknown>) {
    const res = await fetch(`/api/admin/credit-packages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!json.success) {
      toast.error(json.error?.message ?? "Couldn't save package.");
      return;
    }
    toast.success("Credit package updated.");
    await loadAll();
  }

  async function createPackage() {
    const creditAmount = Number(newPackage.creditAmount);
    const priceRupees = Number(newPackage.priceInPaise);
    if (!newPackage.name || !Number.isFinite(creditAmount) || creditAmount <= 0 || !Number.isFinite(priceRupees)) {
      toast.error("Fill in a name, a positive credit amount, and a price.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/credit-packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newPackage.name,
          creditAmount,
          priceInPaise: Math.round(priceRupees * 100),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't create package.");
        return;
      }
      toast.success("Credit package created.");
      setNewPackage({ name: "", creditAmount: "", priceInPaise: "" });
      await loadAll();
    } finally {
      setCreating(false);
    }
  }

  async function grantCredits() {
    const amount = Number(grantForm.amount);
    const identifiers = grantForm.identifiers
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (identifiers.length === 0 || !Number.isFinite(amount) || amount <= 0) {
      toast.error("List at least one email/phone and a positive credit amount.");
      return;
    }
    const emails = identifiers.filter((id) => id.includes("@"));
    const phones = identifiers.filter((id) => !id.includes("@"));
    setGranting(true);
    try {
      const res = await fetch("/api/admin/credit-grants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails, phones, amount, description: grantForm.description }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't grant credits.");
        return;
      }
      const { usersGranted, identifiersNotFound } = json.data.result;
      if (identifiersNotFound.length > 0) {
        toast.info(`Granted to ${usersGranted} user(s). Not found: ${identifiersNotFound.join(", ")}`);
      } else {
        toast.success(`Granted ${amount} credits to ${usersGranted} user(s).`);
      }
      setGrantForm({ identifiers: "", amount: "", description: "" });
    } finally {
      setGranting(false);
    }
  }

  if (!plans || !packages) {
    return <p className="text-body-sm text-neutral-500">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h2 className="text-label-lg text-neutral-900">Subscription plans</h2>
        {plans.map((plan) => (
          <div key={plan.id} className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-label-md text-neutral-900">{plan.name}</p>
                <p className="text-body-sm text-neutral-500">{plan.billingModel}</p>
              </div>
              <Button
                variant={plan.isActive ? "primary" : "secondary"}
                size="sm"
                onClick={() => patchPlan(plan.id, { isActive: !plan.isActive })}
              >
                {plan.isActive ? "Active" : "Inactive"}
              </Button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div>
                <Label className="text-label-sm text-neutral-600">Price (INR)</Label>
                <Input
                  type="number"
                  defaultValue={rupees(plan.priceInPaise)}
                  onBlur={(e) => {
                    const value = Math.round(Number(e.target.value) * 100);
                    if (value !== plan.priceInPaise) patchPlan(plan.id, { priceInPaise: value });
                  }}
                />
              </div>
              <div>
                <Label className="text-label-sm text-neutral-600">Monthly credits</Label>
                <Input
                  type="number"
                  defaultValue={plan.monthlyCredits}
                  onBlur={(e) => {
                    const value = Number(e.target.value);
                    if (value !== plan.monthlyCredits) patchPlan(plan.id, { monthlyCredits: value });
                  }}
                />
              </div>
              <div>
                <Label className="text-label-sm text-neutral-600">Max downloads/month</Label>
                <Input
                  type="number"
                  placeholder="Unlimited"
                  defaultValue={plan.maxDownloadsPerMonth ?? ""}
                  onBlur={(e) => {
                    const raw = e.target.value;
                    const value = raw === "" ? null : Number(raw);
                    if (value !== plan.maxDownloadsPerMonth) patchPlan(plan.id, { maxDownloadsPerMonth: value });
                  }}
                />
              </div>
            </div>
            {plan.billingModel === "SUBSCRIPTION" && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-label-sm text-neutral-600">Billing interval</Label>
                  <Select
                    value={plan.billingInterval ?? "MONTHLY"}
                    onValueChange={(value) => patchPlan(plan.id, { billingInterval: value })}
                  >
                    <SelectTrigger className="mt-1 h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(BILLING_INTERVAL_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-label-sm text-neutral-600">Trial days</Label>
                  <Input
                    type="number"
                    min={0}
                    defaultValue={plan.trialDays}
                    onBlur={(e) => {
                      const value = Number(e.target.value);
                      if (value !== plan.trialDays) patchPlan(plan.id, { trialDays: value });
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-label-lg text-neutral-900">Credit packages (Pay Per Download)</h2>
        {packages.map((pkg) => (
          <div key={pkg.id} className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="flex items-center justify-between gap-4">
              <Input
                defaultValue={pkg.name}
                className="max-w-xs"
                onBlur={(e) => {
                  if (e.target.value !== pkg.name) patchPackage(pkg.id, { name: e.target.value });
                }}
              />
              <Button
                variant={pkg.isActive ? "primary" : "secondary"}
                size="sm"
                onClick={() => patchPackage(pkg.id, { isActive: !pkg.isActive })}
              >
                {pkg.isActive ? "Active" : "Inactive"}
              </Button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <Label className="text-label-sm text-neutral-600">Credits</Label>
                <Input
                  type="number"
                  defaultValue={pkg.creditAmount}
                  onBlur={(e) => {
                    const value = Number(e.target.value);
                    if (value !== pkg.creditAmount) patchPackage(pkg.id, { creditAmount: value });
                  }}
                />
              </div>
              <div>
                <Label className="text-label-sm text-neutral-600">Price (INR)</Label>
                <Input
                  type="number"
                  defaultValue={rupees(pkg.priceInPaise)}
                  onBlur={(e) => {
                    const value = Math.round(Number(e.target.value) * 100);
                    if (value !== pkg.priceInPaise) patchPackage(pkg.id, { priceInPaise: value });
                  }}
                />
              </div>
            </div>
          </div>
        ))}

        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-4">
          <p className="mb-3 text-label-md text-neutral-900">Add a credit package</p>
          <div className="grid grid-cols-3 gap-3">
            <Input
              placeholder="Name"
              value={newPackage.name}
              onChange={(e) => setNewPackage((p) => ({ ...p, name: e.target.value }))}
            />
            <Input
              type="number"
              placeholder="Credits"
              value={newPackage.creditAmount}
              onChange={(e) => setNewPackage((p) => ({ ...p, creditAmount: e.target.value }))}
            />
            <Input
              type="number"
              placeholder="Price (INR)"
              value={newPackage.priceInPaise}
              onChange={(e) => setNewPackage((p) => ({ ...p, priceInPaise: e.target.value }))}
            />
          </div>
          <Button variant="primary" size="sm" className="mt-3" onClick={createPackage} disabled={creating}>
            <Plus className="size-4" /> Add package
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-label-lg text-neutral-900">Grant credits</h2>
        <p className="text-body-sm text-neutral-500">
          One-off or promotional credit grants to specific users — booked the same way as a
          referral/promo credit (PROMOTIONAL lot). For a recurring monthly grant, use a subscription
          plan above instead.
        </p>
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-4">
          <Label className="text-label-sm text-neutral-600">Emails or phone numbers (one per line or comma-separated)</Label>
          <Textarea
            className="mt-1"
            rows={3}
            placeholder={"user@example.com\n+918234902386"}
            value={grantForm.identifiers}
            onChange={(e) => setGrantForm((g) => ({ ...g, identifiers: e.target.value }))}
          />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <Label className="text-label-sm text-neutral-600">Credits to grant</Label>
              <Input
                type="number"
                value={grantForm.amount}
                onChange={(e) => setGrantForm((g) => ({ ...g, amount: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-label-sm text-neutral-600">Description (optional)</Label>
              <Input
                placeholder="e.g. Launch week bonus"
                value={grantForm.description}
                onChange={(e) => setGrantForm((g) => ({ ...g, description: e.target.value }))}
              />
            </div>
          </div>
          <Button variant="primary" size="sm" className="mt-3" onClick={grantCredits} disabled={granting}>
            Grant credits
          </Button>
        </div>
      </div>
    </div>
  );
}
