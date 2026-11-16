import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { operations } from "@/api.gen.ts";
import { api, unwrap } from "./client.ts";
import { topicsQuery } from "./topics.ts";

// The organizer's list of a competition's entries, oldest first. Participants use api/entry.ts.
export const participantsQuery = (competitionId: string) =>
  queryOptions({
    queryKey: ["participants", { competitionId }],
    queryFn: () => unwrap(api().GET("/participants", { params: { query: { competition_id: competitionId } } })),
  });

export const participantQuery = (id: string) =>
  queryOptions({
    queryKey: ["participant", id],
    queryFn: () => unwrap(api().GET("/participants/{id}", { params: { path: { id } } })),
  });

// What the entry delivered, one row per done topic.
export const submissionsQuery = (participantId: string) =>
  queryOptions({
    queryKey: ["submissions", { participantId }],
    queryFn: () => unwrap(api().GET("/submissions", { params: { query: { participant_id: participantId } } })),
  });

// The topics' counts drop its submissions, so they refetch too. The deleted entry's own page isn't
// refetched while it's still showing; it would 404.
export const deleteParticipantMutation = (competitionId: string) =>
  mutationOptions({
    mutationFn: (id: string) => unwrap(api().DELETE("/participants/{id}", { params: { path: { id } } })),
    onSuccess: (_data, id, _result, { client }) =>
      Promise.all([
        client.invalidateQueries({ queryKey: participantsQuery(competitionId).queryKey }),
        client.invalidateQueries({ queryKey: topicsQuery(competitionId).queryKey }),
        client.invalidateQueries({ queryKey: participantQuery(id).queryKey, refetchType: "none" }),
      ]),
  });

export type Participant = operations["participants.list"]["responses"][200]["content"]["application/json"][number];
