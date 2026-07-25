"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/format";

type DiscountType = "PERCENT" | "FIXED" | "CREDITS";

interface Coupon {
  id: string;
  code: string;
  discountType: DiscountType;
  value: number;
  maxRedemptions: number | null;
  redeemedCount: number;
  expiresAt: string | null;
  isActive: boolean;
}

const VALUE_SUFFIX: Record<DiscountType, string> = {
  PERCENT: "%",
  FIXED: "₹",
  CREDITS: " credits",
};

export function CouponsManager() {
  const [coupons, setCoupons] = React.useState<Coupon[] | null>(null);
  const [code, setCode] = React.useState("");
  const [discountType, setDiscountType] = React.useState<DiscountType>("PERCENT");
  const [value, setValue] = React.useState("");
  const [maxRedemptions, setMaxRedemptions] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  const load = React.useCallback(() => {
    fetch("/api/admin/coupons")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setCoupons(json.data.coupons);
      });
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function handleCreate() {
    if (!code.trim() || !value) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          discountType,
          value: Number(value),
          maxRedemptions: maxRedemptions ? Number(maxRedemptions) : null,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't create coupon.");
        return;
      }
      toast.success("Coupon created.");
      setCode("");
      setValue("");
      setMaxRedemptions("");
      load();
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(coupon: Coupon) {
    const res = await fetch(`/api/admin/coupons/${coupon.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !coupon.isActive }),
    });
    const json = await res.json();
    if (!json.success) {
      toast.error(json.error?.message ?? "Couldn't update coupon.");
      return;
    }
    load();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="text-label-lg text-neutral-900">New coupon</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <Label htmlFor="coupon-code">Code</Label>
            <Input id="coupon-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="LAUNCH20" className="mt-1 h-10" />
          </div>
          <div>
            <Label htmlFor="coupon-type">Type</Label>
            <Select value={discountType} onValueChange={(v) => setDiscountType(v as DiscountType)}>
              <SelectTrigger id="coupon-type" className="mt-1 h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PERCENT">Percent off</SelectItem>
                <SelectItem value="FIXED">Fixed amount off (₹)</SelectItem>
                <SelectItem value="CREDITS">Direct credit grant</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="coupon-value">Value</Label>
            <Input id="coupon-value" type="number" value={value} onChange={(e) => setValue(e.target.value)} className="mt-1 h-10" />
          </div>
          <div>
            <Label htmlFor="coupon-max">Max redemptions (optional)</Label>
            <Input id="coupon-max" type="number" value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} className="mt-1 h-10" />
          </div>
        </div>
        <Button type="button" variant="primary" size="sm" className="mt-3" disabled={creating} onClick={handleCreate}>
          {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Create coupon
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-left text-body-sm">
          <thead className="border-b border-neutral-200 text-label-sm text-neutral-500">
            <tr>
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Value</th>
              <th className="px-4 py-2">Redeemed</th>
              <th className="px-4 py-2">Expires</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {!coupons || coupons.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-neutral-500">
                  {coupons === null ? "Loading…" : "No coupons yet."}
                </td>
              </tr>
            ) : (
              coupons.map((c) => (
                <tr key={c.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-2 font-medium text-neutral-900">{c.code}</td>
                  <td className="px-4 py-2">
                    {c.value}
                    {VALUE_SUFFIX[c.discountType]}
                  </td>
                  <td className="px-4 py-2 text-neutral-500">
                    {c.redeemedCount}
                    {c.maxRedemptions ? ` / ${c.maxRedemptions}` : ""}
                  </td>
                  <td className="px-4 py-2 text-neutral-500">{c.expiresAt ? formatDate(new Date(c.expiresAt)) : "Never"}</td>
                  <td className="px-4 py-2">
                    <Badge variant={c.isActive ? "success" : "neutral"} outline>
                      {c.isActive ? "Active" : "Disabled"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => toggleActive(c)}>
                      {c.isActive ? "Disable" : "Enable"}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
