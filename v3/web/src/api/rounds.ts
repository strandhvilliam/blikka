import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import type { operations, paths } from "@/api.gen.ts";
import { api, unwrap } from "./client.ts";
import type { Topic } from "./topics.ts";

export type Round = operations["rounds.get"]["responses"][200]["content"]["application/json"];

export type RoundCreate = NonNullable<paths["/rounds"]["post"]["requestBody"]>["content"]["application/json"];

export type RoundRules = Round["rules"];

export type Result = operations["rounds.results"]["responses"][200]["content"]["application/json"][number];

export type Voter = operations["voters.list"]["responses"][200]["content"]["application/json"][number];

export const roundsQuery = (competitionId: string) =>
  queryOptions({
    queryKey: ["rounds", { competitionId }],
    queryFn: () => unwrap(api().GET("/rounds", { params: { query: { competition_id: competitionId } } })),
  });

export const roundQuery = (id: string) =>
  queryOptions({
    queryKey: ["rounds", id],
    queryFn: async () => {
      const result = await api().GET("/rounds/{id}", { params: { path: { id } } });

      if (result.response.status === 404 || result.response.status === 400) {
        return null;
      }

      return unwrap(result);
    },
  });

export const resultsQuery = (roundId: string) =>
  queryOptions({
    queryKey: ["rounds", roundId, "results"],
    queryFn: () => unwrap(api().GET("/rounds/{id}/results", { params: { path: { id: roundId } } })),
  });

export const votersQuery = (roundId: string) =>
  queryOptions({
    queryKey: ["voters", { roundId }],
    queryFn: () => unwrap(api().GET("/voters", { params: { query: { round_id: roundId } } })),
  });

const refreshRounds = (client: QueryClient, competitionId: string) =>
  client.invalidateQueries({ queryKey: roundsQuery(competitionId).queryKey });

export const createRoundMutation = (competitionId: string) =>
  mutationOptions({
    mutationFn: (body: Omit<RoundCreate, "competition_id">) =>
      unwrap(api().POST("/rounds", { body: { competition_id: competitionId, ...body } })),
    onSuccess: (_round, _body, _result, { client }) => refreshRounds(client, competitionId),
  });

export const updateRoundMutation = (round: Round) =>
  mutationOptions({
    mutationFn: (body: { name?: string; closes_at?: string | null }) =>
      unwrap(api().PATCH("/rounds/{id}", { params: { path: { id: round.id } }, body })),
    onSettled: (_data, _error, _body, _result, { client }) => refreshRounds(client, round.competition_id),
  });

export const openRoundMutation = (round: Round) =>
  mutationOptions({
    mutationFn: (closesAt: string | null) =>
      unwrap(api().POST("/rounds/{id}/open", { params: { path: { id: round.id } }, body: { closes_at: closesAt } })),
    onSettled: (_data, _error, _closesAt, _result, { client }) =>
      Promise.all([
        refreshRounds(client, round.competition_id),
        client.invalidateQueries({ queryKey: resultsQuery(round.id).queryKey }),
      ]),
  });

export const deleteRoundMutation = (round: Round) =>
  mutationOptions({
    mutationFn: () => unwrap(api().DELETE("/rounds/{id}", { params: { path: { id: round.id } } })),
    onSuccess: (_data, _vars, _result, { client }) => refreshRounds(client, round.competition_id),
  });

const refreshVoters = (client: QueryClient, round: Round) =>
  Promise.all([
    client.invalidateQueries({ queryKey: votersQuery(round.id).queryKey }),
    refreshRounds(client, round.competition_id),
  ]);

export const inviteJurorMutation = (round: Round) =>
  mutationOptions({
    mutationFn: (juror: { name: string; email: string }) =>
      unwrap(api().POST("/voters", { body: { round_id: round.id, ...juror } })),
    onSettled: (_data, _error, _juror, _result, { client }) => refreshVoters(client, round),
  });

export const renewLinkMutation = (round: Round) =>
  mutationOptions({
    mutationFn: (voterId: string) => unwrap(api().POST("/voters/{id}/token", { params: { path: { id: voterId } } })),
    onSettled: (_data, _error, _voterId, _result, { client }) => refreshVoters(client, round),
  });

export const revokeVoterMutation = (round: Round) =>
  mutationOptions({
    mutationFn: (voterId: string) => unwrap(api().DELETE("/voters/{id}", { params: { path: { id: voterId } } })),
    onSettled: (_data, _error, _voterId, _result, { client }) => refreshVoters(client, round),
  });

export const jurorLink = (token: string) => `${window.location.origin}/judge/${token}`;

export const roundState = (round: { opens_at: string | null; closes_at: string | null }, now = new Date()) => {
  if (!round.opens_at) {
    return "Draft" as const;
  }

  if (round.closes_at && new Date(round.closes_at) <= now) {
    return "Closed" as const;
  }

  return "Open" as const;
};

export const describeRules = (rules: RoundRules) => {
  if (rules.method === "rating") {
    return `Rate 1 to ${rules.scale}`;
  }

  const picks = rules.max_votes === 1 ? "Pick 1" : `Pick up to ${rules.max_votes}`;

  return rules.favorite ? `${picks}, mark a favorite` : picks;
};

export const voterLabels = { jury: "Jury", participants: "Participants" };

export const poolLabel = (round: Round, topics: ReadonlyArray<Topic>, rounds: ReadonlyArray<Round>) => {
  if (round.source_round_id) {
    const source = rounds.find((r) => r.id === round.source_round_id);

    return source ? `From ${source.name}` : "From an earlier round";
  }

  if (round.topic_id) {
    const topic = topics.find((t) => t.id === round.topic_id);

    return topic ? `${topic.position}. ${topic.name}` : "A deleted topic";
  }

  return "All topics";
};
