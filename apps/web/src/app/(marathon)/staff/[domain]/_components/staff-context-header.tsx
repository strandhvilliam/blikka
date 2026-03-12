import type { ReactNode } from "react";
import { CalendarIcon, ShieldCheckIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface StaffContextHeaderProps {
  action?: ReactNode;
  className?: string;
  domain: string;
  marathonName?: string | null;
  staffEmail?: string | null;
  staffImage?: string | null;
  staffName?: string | null;
}

function getInitials(name?: string | null, email?: string | null) {
  const source = (name || email || "Staff").trim();
  const words = source.split(/\s+/).filter(Boolean);

  if (words.length === 0) return "ST";

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return words
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase();
}

export function StaffContextHeader({
  action,
  className,
  domain,
  marathonName,
  staffEmail,
  staffImage,
  staffName,
}: StaffContextHeaderProps) {
  const resolvedName =
    staffName?.trim() || staffEmail?.trim() || "Staff operator";
  const resolvedSecondaryLabel =
    staffEmail && staffEmail !== resolvedName ? staffEmail : "Staff operator";

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-black/10 bg-white/75 px-4 py-3 shadow-sm backdrop-blur-md md:flex-row md:items-center md:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-stone-950 text-white shadow-sm">
            <CalendarIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[0.65rem] font-medium uppercase tracking-[0.22em] text-muted-foreground">
              <span>Active marathon</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </div>
            <p className="truncate text-sm font-semibold text-foreground">
              {marathonName || "Photomarathon"}
            </p>
            <p className="truncate text-xs uppercase tracking-[0.18em] text-muted-foreground/80">
              {domain}
            </p>
          </div>
        </div>

        <div className="hidden h-10 w-px shrink-0 bg-border md:block" />

        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-9 w-9 shrink-0 ring-1 ring-black/10">
            {staffImage ? (
              <AvatarImage src={staffImage} alt={resolvedName} />
            ) : null}
            <AvatarFallback className="bg-stone-200 text-[11px] font-semibold text-stone-900">
              {getInitials(staffName, staffEmail)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[0.65rem] font-medium uppercase tracking-[0.22em] text-muted-foreground">
              <ShieldCheckIcon className="h-3.5 w-3.5" />
              <span>Logged in</span>
            </div>
            <p className="truncate text-sm font-semibold text-foreground">
              {resolvedName}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {resolvedSecondaryLabel}
            </p>
          </div>
        </div>
      </div>

      {action ? (
        <div className="flex shrink-0 justify-end">{action}</div>
      ) : null}
    </div>
  );
}
