"use client";

import { Badge } from "@/components/ui/badge";

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
        : "border-[#d9d4c7] bg-[#f8f4ea] text-[#605a4f]";

  return (
    <section className="rounded-[1.75rem] border border-[#ddd8ca] bg-white/92 p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="inline-flex rounded-full border border-[#ddd8ca] bg-[#faf7ef] px-4 py-1.5 font-mono text-2xl font-semibold tracking-[0.2em] text-[#1a1713]">
            #{reference}
          </div>
          <div>
            <h3 className="font-rocgrotesk text-3xl leading-none text-[#1c1915]">
              {firstName} {lastName}
            </h3>
            <p className="mt-2 text-sm text-[#666152]">{email}</p>
            {phone ? <p className="mt-1 text-sm text-[#666152]">{phone}</p> : null}
          </div>
        </div>

        <Badge variant="outline" className={badgeClassName}>
          {statusLabel}
        </Badge>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-[#ece7da] bg-[#fcfbf7] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7b7668]">
            Competition class
          </p>
          <p className="mt-2 text-sm font-medium text-[#26231e]">
            {competitionClassName}
          </p>
        </div>
        <div className="rounded-2xl border border-[#ece7da] bg-[#fcfbf7] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7b7668]">
            Device group
          </p>
          <p className="mt-2 text-sm font-medium text-[#26231e]">
            {deviceGroupName}
          </p>
        </div>
      </div>
    </section>
  );
}

