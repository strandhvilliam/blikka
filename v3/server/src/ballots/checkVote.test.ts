import { expect, test } from "bun:test";
import { checkVote } from "./checkVote.ts";

const pick = { method: "pick", max_votes: 3, favorite: false } as const;
const shortlist = { method: "pick", max_votes: 10, favorite: true } as const;
const stars = { method: "rating", scale: 5 } as const;

test("a pick stores 1 and refuses any other value", () => {
  expect(checkVote(pick, {})).toEqual({ value: 1, favorite: undefined });
  expect(checkVote(pick, { value: 1 })).toEqual({ value: 1, favorite: undefined });
  expect(checkVote(pick, { value: 4 })).toBeNull();
});

test("a favorite needs a round that allows one", () => {
  expect(checkVote(pick, { favorite: true })).toBeNull();
  expect(checkVote(pick, { favorite: false })).toEqual({ value: 1, favorite: false });
  expect(checkVote(shortlist, { favorite: true })).toEqual({ value: 1, favorite: true });
});

test("a rating needs a value from 1 to the scale, and no favorite", () => {
  expect(checkVote(stars, { value: 5 })).toEqual({ value: 5, favorite: undefined });
  expect(checkVote(stars, {})).toBeNull();
  expect(checkVote(stars, { value: 0 })).toBeNull();
  expect(checkVote(stars, { value: 6 })).toBeNull();
  expect(checkVote(stars, { value: 3, favorite: true })).toBeNull();
});
