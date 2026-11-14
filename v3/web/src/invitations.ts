import { queryOptions } from "@tanstack/react-query";
import { api } from "./api.ts";
import type { paths } from "./api.gen.ts";

export type ReceivedInvitations =
  paths["/invitations/received"]["get"]["responses"][200]["content"]["application/json"];

export const receivedInvitationsQuery = queryOptions({
  queryKey: ["invitations", "received"],
  queryFn: async () => {
    const { data, response } = await api().GET("/invitations/received");
    if (!data) throw new Error(`Could not list the invitations: ${response.status}`);
    return data;
  },
});

