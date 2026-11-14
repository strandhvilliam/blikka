import { queryOptions } from "@tanstack/react-query";
import { api } from "./api.ts";

export const membersQuery = (organizationId: string) =>
  queryOptions({
    queryKey: ["members", { organizationId }],
    queryFn: async () => {
      const { data, response } = await api().GET("/members", {
        params: { query: { organization_id: organizationId } },
      });
      if (!data) throw new Error(`Could not list the members: ${response.status}`);
      return data;
    },
  });
