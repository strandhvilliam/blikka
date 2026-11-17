import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import type { operations, paths } from "@/api.gen.ts";
import { api, unwrap } from "./client.ts";

type TopicUpdate = NonNullable<paths["/topics/{id}"]["patch"]["requestBody"]>["content"]["application/json"];

export const topicsQuery = (competitionId: string) =>
  queryOptions({
    queryKey: ["topics", { competitionId }],
    queryFn: () => unwrap(api().GET("/topics", { params: { query: { competition_id: competitionId } } })),
  });

const refresh = (client: QueryClient, competitionId: string) =>
  client.invalidateQueries({ queryKey: topicsQuery(competitionId).queryKey });

export const createTopicMutation = (competitionId: string) =>
  mutationOptions({
    mutationFn: (name: string) => unwrap(api().POST("/topics", { body: { competition_id: competitionId, name } })),
    onSuccess: (_data, _name, _result, { client }) => refresh(client, competitionId),
  });

export const updateTopicMutation = (competitionId: string) =>
  mutationOptions({
    mutationFn: ({ id, ...body }: { id: string } & TopicUpdate) =>
      unwrap(api().PATCH("/topics/{id}", { params: { path: { id } }, body })),
    onSettled: (_data, _error, _vars, _result, { client }) => refresh(client, competitionId),
  });

export const deleteTopicMutation = (competitionId: string) =>
  mutationOptions({
    mutationFn: (id: string) => unwrap(api().DELETE("/topics/{id}", { params: { path: { id } } })),
    onSuccess: (_data, _id, _result, { client }) => refresh(client, competitionId),
  });

export type Topic = operations["topics.list"]["responses"][200]["content"]["application/json"][number];
