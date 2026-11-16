import { expect, test } from "bun:test";
import { byStatus, competitionStatus } from "./competitionStatus.ts";

const now = new Date("2026-06-01T12:00:00Z");
const before = "2026-05-01T00:00:00Z";
const after = "2026-07-01T00:00:00Z";

test("status follows publishing and the submission window", () => {
  expect(competitionStatus({ published_at: null, opens_at: before, closes_at: after }, now)).toBe("Draft");
  expect(competitionStatus({ published_at: before, opens_at: null, closes_at: null }, now)).toBe("Upcoming");
  expect(competitionStatus({ published_at: before, opens_at: after, closes_at: null }, now)).toBe("Upcoming");
  expect(competitionStatus({ published_at: before, opens_at: before, closes_at: null }, now)).toBe("Live");
  expect(competitionStatus({ published_at: before, opens_at: before, closes_at: after }, now)).toBe("Live");
  expect(competitionStatus({ published_at: before, opens_at: before, closes_at: before }, now)).toBe("Ended");
  expect(competitionStatus({ published_at: before, opens_at: null, closes_at: before }, now)).toBe("Ended");
});

test("live comes first and ended last, the most recently closed first", () => {
  const ended2025 = { id: "ended-2025", published_at: before, opens_at: before, closes_at: "2025-06-01T00:00:00Z" };
  const ended2026 = { id: "ended-2026", published_at: before, opens_at: before, closes_at: before };
  const draft = { id: "draft", published_at: null, opens_at: null, closes_at: null };
  const upcoming = { id: "upcoming", published_at: before, opens_at: after, closes_at: null };
  const live = { id: "live", published_at: before, opens_at: before, closes_at: after };

  expect(byStatus([ended2025, draft, ended2026, upcoming, live], now).map((c) => c.id)).toEqual([
    "live",
    "upcoming",
    "draft",
    "ended-2026",
    "ended-2025",
  ]);
});
