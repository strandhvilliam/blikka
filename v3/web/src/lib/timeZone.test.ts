import { expect, test } from "bun:test";
import { fromWallClock, toWallClock } from "./timeZone.ts";

test("a wall-clock time in a zone round-trips through its instant", () => {
  const instant = fromWallClock("2026-12-01T09:00", "Europe/Stockholm");
  expect(instant.toISOString()).toBe("2026-12-01T08:00:00.000Z");
  expect(toWallClock(instant, "Europe/Stockholm")).toBe("2026-12-01T09:00");
  expect(toWallClock(instant, "America/New_York")).toBe("2026-12-01T03:00");
});

test("times on either side of a DST change use that side's offset", () => {
  // Stockholm moves from +01:00 to +02:00 at 02:00 on 29 March 2026.
  expect(fromWallClock("2026-03-29T01:30", "Europe/Stockholm").toISOString()).toBe("2026-03-29T00:30:00.000Z");
  expect(fromWallClock("2026-03-29T03:30", "Europe/Stockholm").toISOString()).toBe("2026-03-29T01:30:00.000Z");
  // And back to +01:00 at 03:00 on 25 October 2026.
  expect(fromWallClock("2026-10-25T12:00", "Europe/Stockholm").toISOString()).toBe("2026-10-25T11:00:00.000Z");
});
