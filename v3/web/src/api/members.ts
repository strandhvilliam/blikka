import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { api, ApiError, unwrap } from "./client.ts";
import { organizationQuery, refreshOrganization } from "./organizations.ts";

export const membersQuery = (organizationId: string) =>
  queryOptions({
    queryKey: ["members", { organizationId }],
    queryFn: () => unwrap(api().GET("/members", { params: { query: { organization_id: organizationId } } })),
  });

// Only the owner may, and they become an admin (adr/0008). The caller then calls
// router.invalidate() (see refreshOrganization).
export const transferOwnershipMutation = (organizationId: string) =>
  mutationOptions({
    mutationFn: (userId: string) =>
      unwrap(
        api().PATCH("/members/{user_id}", {
          params: { path: { user_id: userId }, query: { organization_id: organizationId } },
          body: { role: "owner" },
        }),
      ),
    onSuccess: async (_data, _userId, _result, { client }) => {
      await client.invalidateQueries({ queryKey: membersQuery(organizationId).queryKey });
      await refreshOrganization(client, organizationId);
    },
  });

export const removeMemberMutation = (organizationId: string) =>
  mutationOptions({
    mutationFn: (userId: string) => removeMember(organizationId, userId),
    onSuccess: (_data, _userId, _result, { client }) =>
      client.invalidateQueries({ queryKey: membersQuery(organizationId).queryKey }),
  });

// Removes the caller themselves, after which they can't read the organization.
export const leaveOrganizationMutation = (organizationId: string) =>
  mutationOptions({
    mutationFn: (userId: string) => removeMember(organizationId, userId),
    onSuccess: (_data, _userId, _result, { client }) =>
      client.removeQueries({ queryKey: organizationQuery(organizationId).queryKey }),
  });

async function removeMember(organizationId: string, userId: string) {
  const { response } = await api().DELETE("/members/{user_id}", {
    params: { path: { user_id: userId }, query: { organization_id: organizationId } },
  });

  // 404: removed by someone else meanwhile, which is what was asked for.
  if (!response.ok && response.status !== 404) {
    throw new ApiError(response);
  }
}
