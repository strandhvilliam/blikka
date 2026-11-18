import type { RoundRules } from "../rounds/schemas.ts";
import type { VoteInput } from "./schemas.ts";

export const checkVote = (rules: RoundRules, input: VoteInput): { value: number; favorite?: boolean } | null => {
  if (rules.method === "pick") {
    if ((input.value !== undefined && input.value !== 1) || (input.favorite && !rules.favorite)) {
      return null;
    }

    return { value: 1, favorite: input.favorite };
  }

  if (input.value === undefined || input.value < 1 || input.value > rules.scale || input.favorite) {
    return null;
  }

  return { value: input.value, favorite: input.favorite };
};
