import { expect, test } from "bun:test";
import { availableTopics } from "./availableTopics.ts";

const now = new Date("2026-12-01T12:00:00Z");

const at = (minutes: number) => new Date(now.getTime() + minutes * 60_000);
const hourAgo = at(-60);
const inAnHour = at(60);
const topics = [{ id: "a" }, { id: "b" }, { id: "c" }];

const run = ({
  opensAt = hourAgo,
  closesAt = null,
  topicsInSequence = false,
  minutesPerTopic = null,
  entered = at(-120),
  submitted = {},
}: {
  opensAt?: Date | null;
  closesAt?: Date | null;
  topicsInSequence?: boolean;
  minutesPerTopic?: number | null;
  entered?: Date;
  submitted?: Record<string, Date>;
}) =>
  availableTopics(
    { opensAt, closesAt, topicsInSequence, minutesPerTopic, topics },
    { createdAt: entered },
    Object.entries(submitted).map(([topicId, createdAt]) => ({ topicId, createdAt })),
    now,
  );

const statuses = (options: Parameters<typeof run>[0]) => run(options).map((topic) => topic.status);

test("every topic is locked until the window opens, and a null opens_at never opens", () => {
  expect(statuses({ opensAt: null })).toEqual(["locked", "locked", "locked"]);
  expect(statuses({ opensAt: inAnHour })).toEqual(["locked", "locked", "locked"]);
  expect(statuses({ opensAt: inAnHour, topicsInSequence: true })).toEqual(["locked", "locked", "locked"]);
});

test("an open window opens every topic not yet submitted, with or without a deadline", () => {
  expect(statuses({ submitted: { a: hourAgo } })).toEqual(["done", "open", "open"]);
  expect(statuses({ closesAt: inAnHour })).toEqual(["open", "open", "open"]);
  expect(statuses({ opensAt: now })).toEqual(["open", "open", "open"]);
});

test("once the window closes, a topic not submitted is missed and a submitted one stays done", () => {
  expect(statuses({ closesAt: now, submitted: { b: hourAgo } })).toEqual(["missed", "done", "missed"]);
  expect(statuses({ opensAt: null, closesAt: hourAgo })).toEqual(["missed", "missed", "missed"]);
  expect(statuses({ closesAt: now, topicsInSequence: true, submitted: { a: hourAgo } })).toEqual([
    "done",
    "missed",
    "missed",
  ]);
});

test("in sequence, the next topic waits for the previous one's submission when there's no time limit", () => {
  expect(statuses({ topicsInSequence: true })).toEqual(["open", "locked", "locked"]);
  expect(statuses({ topicsInSequence: true, submitted: { a: at(-30) } })).toEqual(["done", "open", "locked"]);
  expect(statuses({ topicsInSequence: true, submitted: { a: at(-30), b: at(-10) } })).toEqual(["done", "done", "open"]);
});

test("a time limit runs from entry, and finishing early unlocks the next topic at once", () => {
  const limited = { topicsInSequence: true, minutesPerTopic: 30, entered: at(-20) };
  expect(run(limited).map(({ status, closesAt }) => ({ status, closesAt }))).toEqual([
    { status: "open", closesAt: at(10) },
    { status: "locked", closesAt: null },
    { status: "locked", closesAt: null },
  ]);
  expect(run({ ...limited, submitted: { a: at(-15) } })[1]).toEqual({ id: "b", status: "open", closesAt: at(15) });
});

test("a topic whose time runs out is missed and the next one unlocks at its deadline", () => {
  const limited = { topicsInSequence: true, minutesPerTopic: 30 };
  expect(run({ ...limited, entered: at(-40) }).map(({ status, closesAt }) => ({ status, closesAt }))).toEqual([
    { status: "missed", closesAt: null },
    { status: "open", closesAt: at(20) },
    { status: "locked", closesAt: null },
  ]);
  expect(statuses({ ...limited, opensAt: at(-100), entered: at(-100) })).toEqual(["missed", "missed", "missed"]);
});

test("entering before the window opens starts the clock when it opens", () => {
  const limited = { topicsInSequence: true, minutesPerTopic: 30, entered: at(-600), opensAt: at(-10) };
  expect(run(limited)[0]).toEqual({ id: "a", status: "open", closesAt: at(20) });
});

test("a topic's deadline is never past the competition's", () => {
  const limited = { topicsInSequence: true, minutesPerTopic: 30, entered: at(-20), closesAt: at(5) };
  expect(run(limited)[0]).toEqual({ id: "a", status: "open", closesAt: at(5) });
});

test("a done topic keeps its deadline, so it can be replaced until then", () => {
  const limited = { topicsInSequence: true, minutesPerTopic: 30, entered: at(-20), submitted: { a: at(-15) } };
  expect(run(limited)[0]).toEqual({ id: "a", status: "done", closesAt: at(10) });
  expect(run({ submitted: { a: hourAgo } })[0]).toEqual({ id: "a", status: "done", closesAt: null });
});

test("topics keep their fields and order", () => {
  expect(
    availableTopics(
      {
        opensAt: hourAgo,
        closesAt: null,
        topicsInSequence: false,
        minutesPerTopic: null,
        topics: [{ id: "b", name: "B" }],
      },
      { createdAt: hourAgo },
      [],
      now,
    ),
  ).toEqual([{ id: "b", name: "B", status: "open", closesAt: null }]);
});
