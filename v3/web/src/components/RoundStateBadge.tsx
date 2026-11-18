import { type Round, roundState } from "@/api/rounds.ts";

const dots = {
  Draft: "border-[1.5px] border-muted-foreground",
  Open: "bg-safelight",
  Closed: "bg-muted-foreground",
};

export function RoundStateBadge({ round }: { round: Pick<Round, "opens_at" | "closes_at"> }) {
  // oxlint-disable-next-line react/purity -- display only, recomputed on each render
  const state = roundState(round, new Date());

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-(--ui-radius) border border-border bg-card px-2 py-0.5 text-xs font-medium ${state === "Closed" ? "text-muted-foreground" : ""}`}
    >
      <span aria-hidden className={`size-2 rounded-full ${dots[state]}`} />
      {state}
    </span>
  );
}
