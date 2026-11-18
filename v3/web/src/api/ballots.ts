import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { operations } from "@/api.gen.ts";
import { api, unwrap } from "./client.ts";

export type Ballot = operations["ballots.list"]["responses"][200]["content"]["application/json"][number];

export type BallotDetail = operations["ballots.get"]["responses"][200]["content"]["application/json"];

export type BallotVote = BallotDetail["votes"][number];

export type BallotAuth = { key: string; headers: { authorization?: string } };

export const jurorAuth = (token: string): BallotAuth => ({
  key: token,
  headers: { authorization: `Bearer ${token}` },
});

export const ballotsQuery = (auth: BallotAuth, competitionId?: string) =>
  queryOptions({
    queryKey: ["ballots", auth.key, { competitionId }],
    queryFn: () =>
      unwrap(
        api().GET("/ballots", {
          params: { query: competitionId ? { competition_id: competitionId } : {} },
          headers: auth.headers,
        }),
      ),
  });

export const ballotQuery = (auth: BallotAuth, id: string) =>
  queryOptions({
    queryKey: ["ballots", auth.key, id],
    queryFn: async () => {
      const result = await api().GET("/ballots/{id}", { params: { path: { id } }, headers: auth.headers });

      if (result.response.status === 404 || result.response.status === 400) {
        return null;
      }

      return unwrap(result);
    },
  });

export const voteMutation = (auth: BallotAuth, id: string) =>
  mutationOptions({
    mutationFn: ({ submissionId, ...body }: { submissionId: string; value?: number; favorite?: boolean }) =>
      unwrap(
        api().PUT("/ballots/{id}/votes/{submission_id}", {
          params: { path: { id, submission_id: submissionId } },
          body,
          headers: auth.headers,
        }),
      ),
    onSettled: (_data, _error, _vars, _result, { client }) =>
      client.invalidateQueries({ queryKey: ballotQuery(auth, id).queryKey }),
  });

export const unvoteMutation = (auth: BallotAuth, id: string) =>
  mutationOptions({
    mutationFn: (submissionId: string) =>
      unwrap(
        api().DELETE("/ballots/{id}/votes/{submission_id}", {
          params: { path: { id, submission_id: submissionId } },
          headers: auth.headers,
        }),
      ),
    onSettled: (_data, _error, _vars, _result, { client }) =>
      client.invalidateQueries({ queryKey: ballotQuery(auth, id).queryKey }),
  });

export const submitBallotMutation = (auth: BallotAuth, id: string) =>
  mutationOptions({
    mutationFn: () => unwrap(api().POST("/ballots/{id}/submit", { params: { path: { id } }, headers: auth.headers })),
    onSettled: (_data, _error, _vars, _result, { client }) =>
      client.invalidateQueries({ queryKey: ["ballots", auth.key] }),
  });
