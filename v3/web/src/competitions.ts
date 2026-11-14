import { queryOptions } from "@tanstack/react-query";
import { api } from "./api.ts";

// An organization's competitions, oldest first. The Api returns [] for an organization the caller
// can't read, so the organization layout is what 404s.
export const competitionsQuery = (organizationId: string) =>
  queryOptions({
    queryKey: ["competitions", { organizationId }],
    queryFn: async () => {
      const { data, response } = await api().GET("/competitions", {
        params: { query: { organization_id: organizationId } },
      });
      if (!data) throw new Error(`Could not list the competitions: ${response.status}`);
      return data;
    },
  });

// The competition, or null when it doesn't exist or the caller can't read it (the Api can't tell them apart).
export const competitionQuery = (id: string) =>
  queryOptions({
    queryKey: ["competitions", id],
    queryFn: async () => {
      const { data, response } = await api().GET("/competitions/{id}", { params: { path: { id } } });
      // 400 is a malformed id, which can't name a competition either.
      if (response.status === 404 || response.status === 400) return null;
      if (!data) throw new Error(`Could not get the competition: ${response.status}`);
      return data;
    },
  });
