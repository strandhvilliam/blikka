import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { api, unwrap } from "./client.ts";

// What participants call (adr/0004): the Api's /entry routes, which answer only with the caller's own entries.

// A published competition by its slug, or null for a draft or one that doesn't exist (the Api can't tell them apart).
export const entryCompetitionQuery = (slug: string) =>
  queryOptions({
    queryKey: ["entry", "competitions", slug],
    queryFn: async () => {
      const result = await api().GET("/entry/competitions/{slug}", { params: { path: { slug } } });
      if (result.response.status === 404) return null;
      return unwrap(result);
    },
  });

// A guest's token, kept in this browser per competition. A signed-in participant needs none.
const tokenKey = (competitionId: string) => `blikka:guest-token:${competitionId}`;

const storedToken = (competitionId: string) => {
  try {
    return localStorage.getItem(tokenKey(competitionId));
  } catch {
    return null;
  }
};

const storeToken = (competitionId: string, token: string | null) => {
  try {
    if (token) localStorage.setItem(tokenKey(competitionId), token);
    else localStorage.removeItem(tokenKey(competitionId));
  } catch {
    // Private mode: the entry still exists, the guest just can't come back to it on this device.
  }
};

// The caller's entry in this competition, or null. Runs in the browser only, where the token lives.
export const myEntryQuery = (competitionId: string) =>
  queryOptions({
    queryKey: ["entry", "participants", { competitionId }],
    queryFn: async () => {
      const token = storedToken(competitionId);
      const entries = await unwrap(
        api().GET("/entry/participants", {
          params: { query: { competition_id: competitionId } },
          headers: token ? { authorization: `Bearer ${token}` } : {},
        }),
      );
      // Taken over or deleted: the token no longer answers.
      if (token && entries.length === 0) storeToken(competitionId, null);
      // shortcut: a signed-in browser holding a guest token for another email gets two; show the first until a page needs both.
      return entries[0] ?? null;
    },
  });

// Rejects with a 409, tagged AlreadyEntered or EntryClosed, when the email already entered or the
// event closed meanwhile.
export const enterMutation = (competitionId: string) =>
  mutationOptions({
    mutationFn: (guest: { name: string; email: string } | null) =>
      unwrap(api().POST("/entry/participants", { body: { competition_id: competitionId, ...guest } })),
    onSuccess: ({ participant, guest_token }, _guest, _result, { client }) => {
      if (guest_token) storeToken(competitionId, guest_token);
      client.setQueryData(myEntryQuery(competitionId).queryKey, participant);
    },
  });
