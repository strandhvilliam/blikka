import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { operations, paths } from "@/api.gen.ts";
import { api, unwrap } from "./client.ts";

export const competitionsQuery = (organizationId: string) =>
  queryOptions({
    queryKey: ["competitions", { organizationId }],
    queryFn: () => unwrap(api().GET("/competitions", { params: { query: { organization_id: organizationId } } })),
  });

export const competitionQuery = (id: string) =>
  queryOptions({
    queryKey: ["competitions", id],
    queryFn: async () => {
      const result = await api().GET("/competitions/{id}", { params: { path: { id } } });

      if (result.response.status === 404 || result.response.status === 400) {
        return null;
      }

      return unwrap(result);
    },
  });

export type Competition = operations["competitions.get"]["responses"][200]["content"]["application/json"];

export type CompetitionUpdate = NonNullable<
  paths["/competitions/{id}"]["patch"]["requestBody"]
>["content"]["application/json"];

export const updateCompetitionMutation = (id: string) =>
  mutationOptions({
    mutationFn: (body: CompetitionUpdate) =>
      unwrap(api().PATCH("/competitions/{id}", { params: { path: { id } }, body })),
    onSuccess: (competition, _body, _result, { client }) => {
      client.setQueryData(competitionQuery(id).queryKey, competition);

      return client.invalidateQueries({ queryKey: competitionsQuery(competition.organization_id).queryKey });
    },
  });

export const deleteCompetitionMutation = (competition: { id: string; organization_id: string }) =>
  mutationOptions({
    mutationFn: () => unwrap(api().DELETE("/competitions/{id}", { params: { path: { id: competition.id } } })),
    onSuccess: (_data, _vars, _result, { client }) => {
      client.removeQueries({ queryKey: competitionQuery(competition.id).queryKey });

      return client.invalidateQueries({ queryKey: competitionsQuery(competition.organization_id).queryKey });
    },
  });

export type CompetitionCreate = NonNullable<
  paths["/competitions"]["post"]["requestBody"]
>["content"]["application/json"];

export const createCompetitionMutation = (organizationId: string) =>
  mutationOptions({
    mutationFn: (body: Omit<CompetitionCreate, "organization_id">) =>
      unwrap(api().POST("/competitions", { body: { ...body, organization_id: organizationId } })),
    onSuccess: (_data, _body, _result, { client }) =>
      client.invalidateQueries({ queryKey: competitionsQuery(organizationId).queryKey }),
  });
