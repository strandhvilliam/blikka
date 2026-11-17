import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import { api, unwrap } from "./client.ts";

export const refreshOrganization = (client: QueryClient, id: string) =>
  Promise.all([
    client.fetchQuery({ ...organizationQuery(id), staleTime: 0 }),
    client.invalidateQueries({ queryKey: organizationsQuery.queryKey, exact: true }),
  ]);

export const organizationQuery = (id: string) =>
  queryOptions({
    queryKey: ["organizations", id],
    queryFn: async () => {
      const result = await api().GET("/organizations/{id}", { params: { path: { id } } });

      if (result.response.status === 404 || result.response.status === 400) {
        return null;
      }

      return unwrap(result);
    },
  });

export const organizationsQuery = queryOptions({
  queryKey: ["organizations"],
  queryFn: () => unwrap(api().GET("/organizations")),
});

export const createOrganizationMutation = mutationOptions({
  mutationFn: (name: string) => unwrap(api().POST("/organizations", { body: { name } })),
  onSuccess: (_data, _name, _result, { client }) =>
    client.invalidateQueries({ queryKey: organizationsQuery.queryKey, exact: true }),
});

export const renameOrganizationMutation = (id: string) =>
  mutationOptions({
    mutationFn: (name: string) =>
      unwrap(api().PATCH("/organizations/{id}", { params: { path: { id } }, body: { name } })),
    onSuccess: (_data, _name, _result, { client }) => refreshOrganization(client, id),
  });

export const deleteOrganizationMutation = (id: string) =>
  mutationOptions({
    mutationFn: () => unwrap(api().DELETE("/organizations/{id}", { params: { path: { id } } })),
    onSuccess: (_data, _vars, _result, { client }) =>
      client.removeQueries({ queryKey: organizationQuery(id).queryKey }),
  });
