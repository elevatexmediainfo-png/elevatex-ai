"use client";

import * as React from "react";
import Link from "next/link";

import { Badge, type BadgeVariant } from "@/components/ui/badge";

interface CommandCenterAlert {
  key: string;
  label: string;
  status: "OK" | "ALERT";
  detail: string;
  actionHref: string;
}

interface InstallationChecklistItem {
  key: string;
  label: string;
  status: "OK" | "WARNING" | "ACTION_NEEDED";
  detail: string;
}

interface CommandCenterReport {
  alerts: CommandCenterAlert[];
  alertCount: number;
  installation: {
    items: InstallationChecklistItem[];
    actionNeededCount: number;
    readyForProduction: boolean;
  };
}

const ALERT_BADGE: Record<CommandCenterAlert["status"], BadgeVariant> = {
  OK: "success",
  ALERT: "error",
};

const INSTALLATION_BADGE: Record<InstallationChecklistItem["status"], BadgeVariant> = {
  OK: "success",
  WARNING: "warning",
  ACTION_NEEDED: "error",
};

export function CommandCenterDashboard() {
  const [report, setReport] = React.useState<CommandCenterReport | null>(null);

  React.useEffect(() => {
    fetch("/api/admin/command-center")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setReport(json.data.report);
      });
  }, []);

  if (!report) return <p className="text-body-sm text-neutral-500">Loading…</p>;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-label-lg text-neutral-900">
          Alerts {report.alertCount > 0 && <Badge variant="error">{report.alertCount}</Badge>}
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {report.alerts.map((alert) => (
            <Link
              key={alert.key}
              href={alert.actionHref}
              className="rounded-xl border border-neutral-200 bg-white px-4 py-3 transition-colors hover:border-neutral-300"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-label-md text-neutral-900">{alert.label}</p>
                <Badge variant={ALERT_BADGE[alert.status]}>{alert.status}</Badge>
              </div>
              <p className="mt-1 text-body-sm text-neutral-500">{alert.detail}</p>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-label-lg text-neutral-900">
          Installation checklist{" "}
          {report.installation.readyForProduction ? (
            <Badge variant="success">Ready</Badge>
          ) : (
            <Badge variant="error">{report.installation.actionNeededCount} action(s) needed</Badge>
          )}
        </h2>
        <div className="mt-3 flex flex-col gap-2">
          {report.installation.items.map((item) => (
            <div key={item.key} className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-label-md text-neutral-900">{item.label}</p>
                <Badge variant={INSTALLATION_BADGE[item.status]}>{item.status.replace("_", " ")}</Badge>
              </div>
              <p className="mt-1 text-body-sm text-neutral-500">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
