import { expect, test } from "bun:test";
import { rank, tiedForFirst } from "./rank.ts";

const tally = (id: string, votes: number, favorites = 0, average: number | null = null) => ({
  id,
  votes,
  favorites,
  average,
});

const ranks = (ranked: ReadonlyArray<{ id: string; rank: number }>) => ranked.map((r) => `${r.rank}:${r.id}`);

test("a pick round ranks by votes, and equal votes share a rank", () => {
  const ranked = rank("pick", [tally("a", 2), tally("b", 5), tally("c", 2), tally("d", 0)]);

  expect(ranks(ranked)).toEqual(["1:b", "2:a", "2:c", "4:d"]);
});

test("favorites rank before votes in a pick round", () => {
  const ranked = rank("pick", [tally("a", 6, 0), tally("b", 3, 2), tally("c", 4, 2)]);

  expect(ranks(ranked)).toEqual(["1:c", "2:b", "3:a"]);
});

test("a rating round ranks by average, then by how many rated it, with unrated entries last", () => {
  const ranked = rank("rating", [
    tally("a", 2, 0, 4),
    tally("b", 0, 0, null),
    tally("c", 3, 0, 4),
    tally("d", 1, 0, 5),
  ]);

  expect(ranks(ranked)).toEqual(["1:d", "2:c", "3:a", "4:b"]);
});

test("tiedForFirst lists the entries sharing first place, and none without a tie", () => {
  expect(tiedForFirst(rank("pick", [tally("a", 3), tally("b", 3), tally("c", 1)])).map((r) => r.id)).toEqual([
    "a",
    "b",
  ]);
  expect(tiedForFirst(rank("pick", [tally("a", 3), tally("b", 2)]))).toEqual([]);
  expect(tiedForFirst(rank("pick", []))).toEqual([]);
});
