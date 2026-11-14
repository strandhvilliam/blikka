import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { api } from "./api.ts";

// After a rename or a transfer: the layout reads the organization from route context, which
// beforeLoad fills from the cache, so the cache refetches first and then the routes reload.
// fetchQuery, not invalidateQueries: a query rendered on the server reaches the browser without
// its queryFn, so invalidating it doesn't refetch it.
export const useRefreshOrganization = () => {
  const queryClient = useQueryClient();
  const router = useRouter();
  return async (id: string) => {
    await Promise.all([
      queryClient.fetchQuery({ ...organizationQuery(id), staleTime: 0 }),
      queryClient.invalidateQueries({ queryKey: organizationsQuery.queryKey, exact: true }),
    ]);
    await router.invalidate();
  };
};

// The organization, or null when it doesn't exist or the caller isn't a member (the Api can't tell them apart).
export const organizationQuery = (id: string) =>
  queryOptions({
    queryKey: ["organizations", id],
    queryFn: async () => {
      const { data, response } = await api().GET("/organizations/{id}", { params: { path: { id } } });
      // 400 is a malformed id, which can't name an organization either.
      if (response.status === 404 || response.status === 400) return null;
      if (!data) throw new Error(`Could not get the organization: ${response.status}`);
      return data;
    },
  });

// The caller's organizations with their role, oldest first. No staleTime, so /dashboard always
// asks the Api and never sends someone who just created an org back to onboarding.
export const organizationsQuery = queryOptions({
  queryKey: ["organizations"],
  queryFn: async () => {
    const { data, response } = await api().GET("/organizations");
    if (!data) throw new Error(`Could not list the organizations: ${response.status}`);
    return data;
  },
});
