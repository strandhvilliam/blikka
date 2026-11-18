import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { api, unwrap } from "./client.ts";

export const entryCompetitionQuery = (slug: string) =>
  queryOptions({
    queryKey: ["entry", "competitions", slug],
    queryFn: async () => {
      const result = await api().GET("/entry/competitions/{slug}", { params: { path: { slug } } });

      if (result.response.status === 404) {
        return null;
      }

      return unwrap(result);
    },
  });

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
    if (token) {
      localStorage.setItem(tokenKey(competitionId), token);
    } else {
      localStorage.removeItem(tokenKey(competitionId));
    }
  } catch {}
};

const guestAuth = (competitionId: string) => {
  const token = storedToken(competitionId);

  return token ? { authorization: `Bearer ${token}` } : {};
};

export const participantBallotAuth = (competitionId: string) => ({
  key: `participant:${competitionId}`,
  headers: guestAuth(competitionId),
});

export const myEntryQuery = (competitionId: string) =>
  queryOptions({
    queryKey: ["entry", "participants", { competitionId }],
    queryFn: async () => {
      const token = storedToken(competitionId);

      const entries = await unwrap(
        api().GET("/entry/participants", {
          params: { query: { competition_id: competitionId } },
          headers: guestAuth(competitionId),
        }),
      );

      if (token && entries.length === 0) {
        storeToken(competitionId, null);
      }

      return entries[0] ?? null;
    },
  });

export const enterMutation = (competitionId: string) =>
  mutationOptions({
    mutationFn: (guest: GuestDetails | null) =>
      unwrap(api().POST("/entry/participants", { body: { competition_id: competitionId, ...guest } })),
    onSuccess: ({ participant, guest_token }, guest, _result, { client }) => {
      if (guest_token) {
        storeToken(competitionId, guest_token);
      }

      if (guest) {
        rememberGuest(guest);
      }

      client.setQueryData(myEntryQuery(competitionId).queryKey, participant);
    },
  });

export const entryTopicsQuery = (competitionId: string, participantId: string) =>
  queryOptions({
    queryKey: ["entry", "topics", { participantId }],
    queryFn: () =>
      unwrap(
        api().GET("/entry/topics", {
          params: { query: { participant_id: participantId } },
          headers: guestAuth(competitionId),
        }),
      ),
  });

export const submitMutation = (competitionId: string, participantId: string) =>
  mutationOptions({
    mutationFn: (topicId: string) =>
      unwrap(
        api().POST("/entry/submissions", {
          body: { participant_id: participantId, topic_id: topicId },
          headers: guestAuth(competitionId),
        }),
      ),
    onSettled: (_submission, _error, _topicId, _result, { client }) =>
      client.invalidateQueries({ queryKey: entryTopicsQuery(competitionId, participantId).queryKey }),
  });

const detailsKey = "blikka:guest-details";

export type GuestDetails = { name: string; email: string };

export const rememberedGuest = (): GuestDetails => {
  try {
    return { name: "", email: "", ...JSON.parse(localStorage.getItem(detailsKey) ?? "{}") };
  } catch {
    return { name: "", email: "" };
  }
};

const rememberGuest = (guest: GuestDetails) => {
  try {
    localStorage.setItem(detailsKey, JSON.stringify(guest));
  } catch {}
};
