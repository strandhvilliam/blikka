"use client";

import { cn } from "@/lib/utils";

interface StaffParticipantCardProps {
  reference: string;
  firstName: string;
  lastName: string;
  email: string;
  competitionClassName: string;
  deviceGroupName: string;
  statusLabel: string;
  statusTone?: "default" | "warning" | "success";
}

const STATUS_STYLES = {
  default: "border-stone-200 bg-stone-50 text-stone-600",
  warning: "border-amber-300 bg-amber-50 text-amber-700",
  success: "border-emerald-300 bg-emerald-50 text-emerald-700",
} as const;

export function StaffParticipantCard({
  reference,
  firstName,
  lastName,
  email,
  competitionClassName,
  deviceGroupName,
  statusLabel,
  statusTone = "default",
}: StaffParticipantCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-stretch">
        <div className="flex shrink-0 flex-col items-center justify-center border-r border-border px-6 py-5 sm:px-8">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            No.
          </span>
          <span className="mt-1 font-mono text-4xl font-bold leading-none tracking-wide text-foreground sm:text-5xl">
            {reference}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3 px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-gothic text-xl font-medium leading-tight tracking-tight text-foreground sm:text-2xl">
                {firstName} {lastName}
              </p>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {email}
              </p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs font-semibold",
                STATUS_STYLES[statusTone],
              )}
            >
              {statusLabel}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <InfoChip label="Class" value={competitionClassName} />
            <InfoChip label="Device" value={deviceGroupName} />
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-xs">
      <span className="font-medium text-muted-foreground">{label}:</span>
      <span className="font-semibold text-foreground">{value}</span>
    </span>
  );
}
