import { queryOptions } from "@tanstack/react-query";
import { api } from "./api.ts";

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
