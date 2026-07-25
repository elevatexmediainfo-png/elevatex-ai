"use client";

import * as React from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ConfigEntry {
  value: unknown;
  label: string;
  description: string;
  category: string;
  inputType: "enum" | "number" | "boolean" | "string" | "string_list" | "json";
  options?: string[];
}

// Generic — renders whatever's in CONFIG_REGISTRY (lib/admin/config.ts) for
// the requested categories, with no per-field UI code to maintain. Adding a
// new admin-editable setting is a registry entry, not a new component.
export function AdminConfigForm({ sections }: { sections: { category: string; title: string }[] }) {
  const [config, setConfig] = React.useState<Record<string, ConfigEntry> | null>(null);
  const [savingKey, setSavingKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/admin/config")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setConfig(json.data.config);
      });
  }, []);

  async function save(key: string, value: unknown, label: string) {
    setSavingKey(key);
    try {
      const res = await fetch("/api/admin/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? "Couldn't save.");
        return;
      }
      setConfig(json.data.config);
      toast.success(`${label} updated.`);
    } catch {
      toast.error("Couldn't save. Please try again.");
    } finally {
      setSavingKey(null);
    }
  }

  if (!config) {
    return <p className="text-body-sm text-neutral-500">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      {sections.map((section) => {
        const entries = Object.entries(config).filter(([, entry]) => entry.category === section.category);
        if (entries.length === 0) return null;

        return (
          <div key={section.category} className="flex flex-col gap-3">
            <h2 className="text-label-lg text-neutral-900">{section.title}</h2>
            {entries.map(([key, entry]) => (
              <div key={key} className="rounded-xl border border-neutral-200 bg-white p-4">
                <Label className="text-label-md text-neutral-900">{entry.label}</Label>
                <p className="mt-0.5 text-body-sm text-neutral-500">{entry.description}</p>
                <div className="mt-3 max-w-xs">
                  {entry.inputType === "boolean" ? (
                    <Switch
                      checked={Boolean(entry.value)}
                      disabled={savingKey === key}
                      onCheckedChange={(checked) => save(key, checked, entry.label)}
                    />
                  ) : entry.inputType === "enum" ? (
                    <Select
                      value={String(entry.value)}
                      onValueChange={(v) => save(key, v, entry.label)}
                      disabled={savingKey === key}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {entry.options?.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : entry.inputType === "string_list" ? (
                    <Input
                      type="text"
                      defaultValue={Array.isArray(entry.value) ? entry.value.join(", ") : String(entry.value)}
                      disabled={savingKey === key}
                      placeholder={entry.options?.join(", ")}
                      onBlur={(e) => {
                        const value = e.target.value
                          .split(",")
                          .map((v) => v.trim())
                          .filter(Boolean);
                        if (JSON.stringify(value) !== JSON.stringify(entry.value)) save(key, value, entry.label);
                      }}
                    />
                  ) : entry.inputType === "json" ? (
                    <textarea
                      className="w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-body-sm"
                      rows={6}
                      defaultValue={JSON.stringify(entry.value, null, 2)}
                      disabled={savingKey === key}
                      onBlur={(e) => {
                        let value: unknown;
                        try {
                          value = JSON.parse(e.target.value);
                        } catch {
                          toast.error("Invalid JSON — change not saved.");
                          return;
                        }
                        if (JSON.stringify(value) !== JSON.stringify(entry.value)) save(key, value, entry.label);
                      }}
                    />
                  ) : (
                    <Input
                      type={entry.inputType === "number" ? "number" : "text"}
                      defaultValue={String(entry.value)}
                      disabled={savingKey === key}
                      onBlur={(e) => {
                        const raw = e.target.value;
                        const value = entry.inputType === "number" ? Number(raw) : raw;
                        if (String(value) !== String(entry.value)) save(key, value, entry.label);
                      }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
