import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { api } from "./api.ts";
import type { paths } from "./api.gen.ts";

export type ReceivedInvitations =
  paths["/invitations/received"]["get"]["responses"][200]["content"]["application/json"];

export const invitationsQuery = (organizationId: string) =>
  queryOptions({
    queryKey: ["invitations", { organizationId }],
    queryFn: async () => {
      const { data, response } = await api().GET("/invitations", {
        params: { query: { organization_id: organizationId } },
      });
      if (!data) throw new Error(`Could not list the invitations: ${response.status}`);
      return data;
    },
  });

export const receivedInvitationsQuery = queryOptions({
  queryKey: ["invitations", "received"],
  queryFn: async () => {
    const { data, response } = await api().GET("/invitations/received");
    if (!data) throw new Error(`Could not list the invitations: ${response.status}`);
    return data;
  },
});

// Joins and opens the organization. False when the invitation was revoked or expired meanwhile,
// and the refetch has dropped it.
export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return async (id: string) => {
    const { data } = await api().POST("/invitations/{id}/accept", { params: { path: { id } } });
    await queryClient.invalidateQueries({ queryKey: ["invitations"] });
    if (!data) return false;
    await queryClient.invalidateQueries({ queryKey: ["organizations"] });
    await navigate({ to: "/dashboard/$organizationId", params: { organizationId: data.organization_id } });
    return true;
  };
}
