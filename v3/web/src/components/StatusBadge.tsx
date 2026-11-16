import type { CompetitionStatus } from "@/lib/competitionStatus.ts";

const dots: Record<CompetitionStatus, string> = {
  Live: "bg-safelight",
  Upcoming: "bg-blue-hour",
  Draft: "border-[1.5px] border-muted-foreground",
  Ended: "bg-muted-foreground",
};

export function StatusBadge({ status }: { status: CompetitionStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${status === "Ended" ? "text-muted-foreground" : ""}`}
    >
      <span aria-hidden className={`size-2 rounded-full ${dots[status]}`} />
      {status}
    </span>
  );
}
