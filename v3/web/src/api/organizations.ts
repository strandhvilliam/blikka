import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import { api, unwrap } from "./client.ts";

// After a rename or a transfer. fetchQuery, not invalidateQueries: a query rendered on the server
// reaches the browser without its queryFn, so invalidating it doesn't refetch it. The caller then
// calls router.invalidate(), since the layout reads the organization from route context, which
// beforeLoad fills from this cache.
export const refreshOrganization = (client: QueryClient, id: string) =>
  Promise.all([
    client.fetchQuery({ ...organizationQuery(id), staleTime: 0 }),
    client.invalidateQueries({ queryKey: organizationsQuery.queryKey, exact: true }),
  ]);

// The organization, or null when it doesn't exist or the caller isn't a member (the Api can't tell them apart).
export const organizationQuery = (id: string) =>
  queryOptions({
    queryKey: ["organizations", id],
    queryFn: async () => {
      const result = await api().GET("/organizations/{id}", { params: { path: { id } } });
      // 400 is a malformed id, which can't name an organization either.
      if (result.response.status === 404 || result.response.status === 400) return null;
      return unwrap(result);
    },
  });

// The caller's organizations with their role, oldest first. No staleTime, so /dashboard always
// asks the Api and never sends someone who just created an org back to onboarding.
export const organizationsQuery = queryOptions({
  queryKey: ["organizations"],
  queryFn: () => unwrap(api().GET("/organizations")),
});

export const createOrganizationMutation = mutationOptions({
  mutationFn: (name: string) => unwrap(api().POST("/organizations", { body: { name } })),
  onSuccess: (_data, _name, _result, { client }) =>
    client.invalidateQueries({ queryKey: organizationsQuery.queryKey, exact: true }),
});

// The caller then calls router.invalidate() (see refreshOrganization).
export const renameOrganizationMutation = (id: string) =>
  mutationOptions({
    mutationFn: (name: string) =>
      unwrap(api().PATCH("/organizations/{id}", { params: { path: { id } }, body: { name } })),
    onSuccess: (_data, _name, _result, { client }) => refreshOrganization(client, id),
  });

// Only the owner may (adr/0008).
export const deleteOrganizationMutation = (id: string) =>
  mutationOptions({
    mutationFn: () => unwrap(api().DELETE("/organizations/{id}", { params: { path: { id } } })),
    onSuccess: (_data, _vars, _result, { client }) => client.removeQueries({ queryKey: organizationQuery(id).queryKey }),
  });
