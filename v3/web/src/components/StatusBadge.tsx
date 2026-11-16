import type { CompetitionStatus } from "@/lib/competitionStatus.ts";

const styles: Record<CompetitionStatus, { badge: string; dot: string }> = {
  Live: { badge: "bg-muted", dot: "bg-safelight" },
  Upcoming: { badge: "bg-muted", dot: "bg-blue-hour" },
  Draft: { badge: "ring-1 ring-border ring-inset", dot: "border-[1.5px] border-muted-foreground" },
  Ended: { badge: "text-muted-foreground", dot: "bg-muted-foreground" },
};

export function StatusBadge({ status }: { status: CompetitionStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[7px] px-2 py-0.5 text-xs font-medium ${styles[status].badge}`}
    >
      <span aria-hidden className={`size-1.5 rounded-full ${styles[status].dot}`} />
      {status}
    </span>
  );
}
