import { expect, test } from "bun:test";
import { availableTopics } from "./availableTopics.ts";

const now = new Date("2026-12-01T12:00:00Z");
const hourAgo = new Date("2026-12-01T11:00:00Z");
const inAnHour = new Date("2026-12-01T13:00:00Z");
const topics = [{ id: "a" }, { id: "b" }];

const statuses = (opensAt: Date | null, closesAt: Date | null, submitted: Array<string> = []) =>
  availableTopics(
    { opensAt, closesAt, topics },
    submitted.map((topicId) => ({ topicId })),
    now,
  ).map((topic) => topic.status);

test("every topic is locked until the window opens, and a null opens_at never opens", () => {
  expect(statuses(null, null)).toEqual(["locked", "locked"]);
  expect(statuses(inAnHour, null)).toEqual(["locked", "locked"]);
});

test("an open window opens every topic not yet submitted, with or without a deadline", () => {
  expect(statuses(hourAgo, null, ["a"])).toEqual(["done", "open"]);
  expect(statuses(hourAgo, inAnHour)).toEqual(["open", "open"]);
  expect(statuses(now, null)).toEqual(["open", "open"]);
});

test("once the window closes, a topic not submitted is missed and a submitted one stays done", () => {
  expect(statuses(hourAgo, now, ["b"])).toEqual(["missed", "done"]);
  // Closed by hand before it ever opened.
  expect(statuses(null, hourAgo)).toEqual(["missed", "missed"]);
});

test("topics keep their fields and order", () => {
  expect(availableTopics({ opensAt: hourAgo, closesAt: null, topics: [{ id: "b", name: "B" }] }, [], now)).toEqual([
    { id: "b", name: "B", status: "open" },
  ]);
});
