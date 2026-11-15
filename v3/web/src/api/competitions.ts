import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { paths } from "@/api.gen.ts";
import { api, unwrap } from "./client.ts";

// An organization's competitions, oldest first. The Api returns [] for an organization the caller
// can't read, so the organization layout is what 404s.
export const competitionsQuery = (organizationId: string) =>
  queryOptions({
    queryKey: ["competitions", { organizationId }],
    queryFn: () => unwrap(api().GET("/competitions", { params: { query: { organization_id: organizationId } } })),
  });

// The competition, or null when it doesn't exist or the caller can't read it (the Api can't tell them apart).
export const competitionQuery = (id: string) =>
  queryOptions({
    queryKey: ["competitions", id],
    queryFn: async () => {
      const result = await api().GET("/competitions/{id}", { params: { path: { id } } });

      // 400 is a malformed id, which can't name a competition either.
      if (result.response.status === 404 || result.response.status === 400) {
        return null;
      }

      return unwrap(result);
    },
  });

export type CompetitionUpdate = NonNullable<
  paths["/competitions/{id}"]["patch"]["requestBody"]
>["content"]["application/json"];

// The caller then calls router.invalidate(), since the event layout reads the competition from
// route context, which beforeLoad fills from this cache.
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

// Rejects with a 409 when the name is taken in the organization.
export const createCompetitionMutation = (organizationId: string) =>
  mutationOptions({
    mutationFn: (name: string) =>
      unwrap(api().POST("/competitions", { body: { organization_id: organizationId, name } })),
    onSuccess: (_data, _name, _result, { client }) =>
      client.invalidateQueries({ queryKey: competitionsQuery(organizationId).queryKey }),
  });
