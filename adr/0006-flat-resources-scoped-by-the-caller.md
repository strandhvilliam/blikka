# ADR-0006: Resources are flat collections, and a read only ever returns what the caller can access

- **Status**: Proposed
- **Area**: API (`v3`)
- **Date**: 2026-11-12

## Context

Competitions are the first resource that belongs to an organization. The Api needed a shape for
"the competitions of this organization" that the resources after it (participants, submissions)
can copy, and a rule for what a caller sees when they ask for something that isn't theirs.

ADR-0001 gives `authorize(caller, permission, organization)`, which fits a request that names one
organization. A list across organizations, or a get by id alone, names none.

## Decision

### Flat paths, filters in the query

Every resource is a top-level collection. The organization is a filter on a list and a field in a
create, never part of the path:

```
GET  /competitions?organization_id=…    list
POST /competitions                      { organization_id, name }
GET  /competitions/:id                  get
```

Paths stay short as resources nest (a submission is `/submissions/:id`, not four levels deep), and
one list endpoint serves both "this organization's" and "all of mine".

### Reads start from what the caller can access

`PermissionsService.selectAccessibleOrganizationIds(caller, permission)` is the organizations where the
caller's role grants the permission, as a subquery. Every list and get filters by it first, and
any filter from the request is added on top. A filter can narrow the result but never widen it.

- A list with no `organization_id` returns the resource across all the caller's organizations.
- A list with someone else's `organization_id` returns `[]`.
- A get for a row the caller can't read is the same 404 as a row that doesn't exist.

So a read never answers 403, and an outsider can't learn whether an id exists.

### Writes authorize the organization they name

A create names its organization in the body and calls `authorize` from ADR-0001, which answers
404 for a non-member and 403 for a member whose role lacks the permission. An update or delete
loads the row through the same scoped read first, then authorizes against the row's organization.

### Field names on the wire are snake_case

`organization_id`, in queries, bodies and responses. The service maps from the camelCase the
database layer uses.

## Consequences

- A forgotten check on a read fails closed: the query has no rows without the scope, instead of
  every row without an `authorize` call.
- A role that can read part of an organization is one more set in `ROLE_PERMISSIONS`. Reads pick
  it up through `rolesWith(permission)`.
- A member whose role lacks a read permission sees an empty list or a 404, not a 403. The website
  has to use the permission list from `GET /organizations/:id` to explain why, where that matters.
- The website can't rely on the path to know which organization a competition belongs to. A page
  under `/dashboard/$organizationId/` checks the row's `organization_id` against its URL.
- A caller who gets access to single competitions rather than a whole organization (event staff,
  a jury member with an account) widens the scope to "in my organizations, or assigned to me".
  That changes `PermissionsService` and the scoped read, not the endpoints.

## Alternatives considered

- **Nested paths (`/organizations/:id/competitions`).** The path repeats what the row already
  knows, grows with every level, and needs a second endpoint for a list across organizations.
- **`authorize` on every read, with a required `organization_id`.** Gives a 403 for other
  organizations, which confirms they exist, and a get by id has to load the row before it can
  check it.

## Not covered

Participants don't use this. A participant owns their entry and their routes check ownership
(ADR-0004), in their own endpoints, separate from the organizer's.
