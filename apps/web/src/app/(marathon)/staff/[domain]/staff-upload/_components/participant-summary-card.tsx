"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ParticipantSummaryCardProps {
  reference: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  competitionClassName: string;
  deviceGroupName: string;
  statusLabel: string;
  statusTone?: "default" | "warning" | "success";
}

export function ParticipantSummaryCard({
  reference,
  firstName,
  lastName,
  email,
  phone,
  competitionClassName,
  deviceGroupName,
  statusLabel,
  statusTone = "default",
}: ParticipantSummaryCardProps) {
  const badgeClassName =
    statusTone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : statusTone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-border bg-muted text-muted-foreground";

  return (
    <div className="rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="shrink-0 font-mono text-lg font-semibold tracking-[0.15em] text-foreground">
            #{reference}
          </span>
          <span className="truncate font-rocgrotesk text-lg text-foreground">
            {firstName} {lastName}
          </span>
        </div>
        <Badge variant="outline" className={cn("shrink-0", badgeClassName)}>
          {statusLabel}
        </Badge>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-xs text-muted-foreground">{email}</span>
        {phone ? (
          <>
            <span className="text-border">&middot;</span>
            <span className="text-xs text-muted-foreground">{phone}</span>
          </>
        ) : null}
        <span className="text-border">&middot;</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {competitionClassName}
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {deviceGroupName}
        </span>
      </div>
    </div>
  );
}
