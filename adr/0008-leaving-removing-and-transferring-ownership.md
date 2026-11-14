# ADR-0008: Members leave or are removed by a soft delete, and only the owner transfers ownership

- **Status**: Proposed
- **Area**: API (`v3`)
- **Date**: 2026-11-14

## Context

ADR-0007 lets people join an organization, but nobody could leave one, an admin couldn't remove
anyone, and the owner invariants in ADR-0001 named a transfer that didn't exist. That left an
owner stuck in their organization for good.

Owner and admin have the same permissions (ADR-0001), so "only the owner may do this" can't be
written as a permission.

## Decision

### A removed membership is soft-deleted

`organization_members.deleted_at` marks a member who left or was removed. Every membership read
(`PermissionsService`, the member and organization lists, the already-a-member check on invite)
skips those rows, so a removed member gets nothing, as ADR-0001 requires. The row stays as a
record. Accepting a new invitation clears `deleted_at` on the same row and makes them an admin
again, since the key is still (organization, user).

### Removing and leaving are one endpoint

`DELETE /members/:user_id?organization_id=…`. `organization_id` is required, because a member is
the pair. The member is loaded through the scoped read first (ADR-0006), so an outsider gets a 404.

- Your own `user_id` is leaving. It needs no permission: anyone may leave.
- Anyone else's needs `members:write`.
- The owner is a 409 either way. They transfer ownership first.

### The owner transfers ownership with a role change

`PATCH /members/:user_id?organization_id=… { "role": "owner" }`. It's a role change rather than an
organization action, so it can grow when there are more roles. Today it accepts only `"owner"`.
Only the owner may make it, never for themselves. In one transaction, the owner becomes an
admin and the target becomes owner. The demotion runs first, and if the target was removed in
the meantime the transaction rolls back, so the organization never loses its owner. A partial
unique index (`organization_members_one_owner`) enforces one owner per organization in the
database too.

`authorize` returns the caller's role with their permissions, so the owner check doesn't query
again, and `GET /organizations/:id` returns the role so the website can hide what only the owner
can do.

## Consequences

- An owner who wants to leave hands ownership to another member first. A sole member can't
  leave.
- Any admin can remove any other admin. With a single admin role there's nothing finer to
  express. A future role that can't manage members gets that from its permission set.
- Every new query on `organization_members` has to filter on `deleted_at`. The service tests
  cover the existing ones.

## Alternatives considered

- **Hard-delete the membership.** Fewer filters, but it loses the record of who was a member and
  contradicts ADR-0001's soft deletes.
- **`POST /organizations/:id/transfer`.** Says what it does, but it's a one-off endpoint for
  what is a role change.
