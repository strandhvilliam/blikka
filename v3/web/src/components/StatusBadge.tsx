import type { CompetitionStatus } from "@/lib/competitionStatus.ts";

export const statusDots: Record<CompetitionStatus, string> = {
  Live: "bg-safelight",
  Upcoming: "bg-blue-hour",
  Draft: "border-[1.5px] border-muted-foreground",
  Ended: "bg-muted-foreground",
};

export function StatusBadge({ status }: { status: CompetitionStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-(--ui-radius) border border-border bg-card px-2 py-0.5 text-xs font-medium ${status === "Ended" ? "text-muted-foreground" : ""}`}
    >
      <span aria-hidden className={`size-2 rounded-full ${statusDots[status]}`} />
      {status}
    </span>
  );
}
