import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import { api, unwrap } from "./client.ts";
import type { paths } from "@/api.gen.ts";
import { membersQuery } from "./members.ts";
import { organizationsQuery } from "./organizations.ts";

export type ReceivedInvitations =
  paths["/invitations/received"]["get"]["responses"][200]["content"]["application/json"];

export const invitationsQuery = (organizationId: string) =>
  queryOptions({
    queryKey: ["invitations", { organizationId }],
    queryFn: () => unwrap(api().GET("/invitations", { params: { query: { organization_id: organizationId } } })),
  });

export const receivedInvitationsQuery = queryOptions({
  queryKey: ["invitations", "received"],
  queryFn: () => unwrap(api().GET("/invitations/received")),
});

// Always with the address: the name is free text, so it alone doesn't say who is inviting.
export const invitedBy = ({ invited_by: { name, email } }: ReceivedInvitations[number]) =>
  `Invited by ${name ? `${name} (${email})` : email}`;

// Rejects with a 409 when they're already a member. Refetches either way: a failure can mean the
// list changed elsewhere.
export const createInvitationMutation = (organizationId: string) =>
  mutationOptions({
    mutationFn: (email: string) =>
      unwrap(api().POST("/invitations", { body: { organization_id: organizationId, email } })),
    onSettled: (_data, _error, _email, _result, { client }) => refetchMembership(client, organizationId),
  });

// Refetches either way: a failure means it was accepted or revoked elsewhere.
export const revokeInvitationMutation = (organizationId: string) =>
  mutationOptions({
    mutationFn: (id: string) => unwrap(api().DELETE("/invitations/{id}", { params: { path: { id } } })),
    onSettled: (_data, _error, _id, _result, { client }) => refetchMembership(client, organizationId),
  });

const refetchMembership = (client: QueryClient, organizationId: string) =>
  Promise.all([
    client.invalidateQueries({ queryKey: invitationsQuery(organizationId).queryKey }),
    client.invalidateQueries({ queryKey: membersQuery(organizationId).queryKey }),
  ]);

// Joins the organization. A failure means the invitation was revoked or expired meanwhile, and the
// refetch drops it.
export const acceptInvitationMutation = mutationOptions({
  mutationFn: (id: string) => unwrap(api().POST("/invitations/{id}/accept", { params: { path: { id } } })),
  onSuccess: (_data, _id, _result, { client }) => client.invalidateQueries({ queryKey: organizationsQuery.queryKey }),
  onSettled: (_data, _error, _id, _result, { client }) =>
    client.invalidateQueries({ queryKey: receivedInvitationsQuery.queryKey }),
});
