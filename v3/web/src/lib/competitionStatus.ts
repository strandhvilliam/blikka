export type CompetitionStatus = "Live" | "Upcoming" | "Draft" | "Ended";

type Window = { published_at: string | null; opens_at: string | null; closes_at: string | null };

// A null opens_at hasn't opened yet and a null closes_at never closes (ADR-0009).
export function competitionStatus(competition: Window, now = new Date()): CompetitionStatus {
  if (!competition.published_at) {
    return "Draft";
  }

  if (competition.closes_at && new Date(competition.closes_at) <= now) {
    return "Ended";
  }

  if (competition.opens_at && new Date(competition.opens_at) <= now) {
    return "Live";
  }

  return "Upcoming";
}

const order: Record<CompetitionStatus, number> = { Live: 0, Upcoming: 1, Draft: 2, Ended: 3 };

// Live first, then upcoming and drafts, then ended ones, the most recently closed first.
export function byStatus<C extends Window>(competitions: C[], now = new Date()): C[] {
  return competitions.toSorted(
    (a, b) =>
      order[competitionStatus(a, now)] - order[competitionStatus(b, now)] ||
      (b.closes_at ?? "").localeCompare(a.closes_at ?? ""),
  );
}
