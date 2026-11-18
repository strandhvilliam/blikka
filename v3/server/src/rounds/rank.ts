import type { RoundRules } from "./schemas.ts";

export type Tally = { votes: number; favorites: number; average: number | null };

const scoreOf = (method: RoundRules["method"], tally: Tally): ReadonlyArray<number> =>
  method === "pick" ? [tally.favorites, tally.votes] : [tally.average ?? -1, tally.votes];

const compare = (a: ReadonlyArray<number>, b: ReadonlyArray<number>) => {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return b[i]! - a[i]!;
    }
  }

  return 0;
};

export const rank = <T extends Tally>(method: RoundRules["method"], tallies: ReadonlyArray<T>) => {
  const sorted = tallies
    .map((tally) => ({ tally, score: scoreOf(method, tally) }))
    .sort((a, b) => compare(a.score, b.score));

  return sorted.map(({ tally, score }, index) => {
    const previous = sorted[index - 1];
    let first = index;

    if (previous && compare(previous.score, score) === 0) {
      first = sorted.findIndex((other) => compare(other.score, score) === 0);
    }

    return { ...tally, rank: first + 1 };
  });
};

export const tiedForFirst = <T extends { rank: number }>(ranked: ReadonlyArray<T>) => {
  const first = ranked.filter((entry) => entry.rank === 1);

  return first.length > 1 ? first : [];
};
