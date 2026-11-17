import { expect, test } from "bun:test";
import { setupQuestions } from "./setupQuestions.ts";

test("one topic skips how they open and the time limit", () => {
  expect(setupQuestions({ topics: 1, inSequence: false })).toEqual(["name", "topics", "window"]);
  // An answer left from when there were more topics doesn't bring them back.
  expect(setupQuestions({ topics: 1, inSequence: true })).toEqual(["name", "topics", "window"]);
});

test("several topics ask how they open, and only one at a time asks for a time limit", () => {
  expect(setupQuestions({ topics: 3, inSequence: false })).toEqual(["name", "topics", "order", "window"]);
  expect(setupQuestions({ topics: 3, inSequence: true })).toEqual(["name", "topics", "order", "time-limit", "window"]);
});
