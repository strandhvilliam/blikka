import { queryOptions } from "@tanstack/react-query";
import type { operations } from "@/api.gen.ts";
import { api, unwrap } from "./client.ts";

// The organizer's list of a competition's entries, oldest first. Participants use api/entry.ts.
export const participantsQuery = (competitionId: string) =>
  queryOptions({
    queryKey: ["participants", { competitionId }],
    queryFn: () => unwrap(api().GET("/participants", { params: { query: { competition_id: competitionId } } })),
  });

export type Participant = operations["participants.list"]["responses"][200]["content"]["application/json"][number];
