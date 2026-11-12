# ADR-0001: Authorization checks permissions, and a role is a set of permissions

- **Status**: Proposed
- **Area**: API (`v3`)
- **Date**: 2026-11-09

## Context

The old app checks roles inline in each router, for example
`permission.domain === input.domain && permission.role === 'admin'`. This has three problems:

- Adding a role means finding and editing every check that should now let it through.
- The check trusts the `domain` sent by the client. A procedure that then loads a resource by id
  without confirming the resource belongs to that domain lets an admin of one marathon reach
  another marathon's data.
- Nothing lists who may do what, so the only way to answer "can staff export?" is to read the
  routers.

v3 starts from an empty schema, so we can fix this once before any routes exist. Polar's model
(`server/polar/auth/permission.py`, ADR-0005 in their handbook) is the reference for this design.

## Decision

### Callers

Every request resolves to exactly one kind of caller before any check runs:

| Caller | Identified by | Permissions come from |
|---|---|---|
| User | Session cookie or bearer token | Their organization role, or `superadmin` |
| Jury member | Invite token from a `jury_invitations` row | `JURY_PERMISSIONS`, filtered to the invite's scope |
| Anonymous | Nothing | None. Public pages are routes that do no permission check |

A participant is not a role. A participant owns their own entry, through `participants.user_id`
or a guest upload token, and the routes that act on that entry check ownership, not permissions.
ADR-0004 covers how participants enter and how that ownership is checked.

### Roles

Only the roles needed now:

| Level | Role | Permissions |
|---|---|---|
| Platform | `superadmin` | All of them. Set by hand in the database, never through the API |
| Organization | `owner` | Same as `admin` |
| Organization | `admin` | Everything for the organization and all of its competitions |
| Competition | jury (an invite, not a membership) | `jury:rate`, limited to the invite's topic, class or device group |

`owner` and `admin` have the same permissions. The owner differs only by invariants (see below).
Staff and any other roles are left out until a real need comes up. Adding one means adding its
permission set, not changing routes.

### Permissions

Permissions are `resource:action` strings in one list:

```
organization:read       organization:write
members:read            members:write
competitions:read       competitions:write
participants:read       participants:write
submissions:read        submissions:write
jury:read               jury:write              jury:rate
```

Every resource gets two actions:

- `read` covers listing and viewing, including exports, which are bulk reads.
- `write` covers create, update and delete. With soft deletes, a delete is an update.

A more specific action is added only when a role needs part of `write` but not all of it.
Today that is only `jury:rate`: a jury member rates submissions but must not edit them. Jury
routes (list the submissions to rate, save a rating) require `jury:rate`, so the jury never
needs `submissions:read` and can't reach admin reads such as exports. `jury:read` and
`jury:write` are the admin side: seeing ratings and managing invites.

Each permission is listed even when every current role has it, so a future role is one new set
in `ROLE_PERMISSIONS`.

### The check

- `permissions.ts` in `v3/server/src/permissions/` holds the permission list, `ROLE_PERMISSIONS`
  (role to permission set) and `JURY_PERMISSIONS`. That file is the spec. A test asserts each
  role's exact set, so changing one is a visible, reviewed diff.
- Every procedure declares exactly one permission. A test lists all procedures and fails if any
  has none. Routes with no check are opted out explicitly as public.
- One function, `authorize(caller, permission, resource)`, decides. It denies by default.
- The organization or competition a resource belongs to is read from the database row being
  acted on, never from a slug or id in the request.
- A soft-deleted organization, competition or membership, or an expired or revoked jury invite,
  grants nothing.
- The API returns the caller's permission list, so the frontend hides actions with the same list
  the API enforces. The frontend check is cosmetic. The API check is the one that counts.

### What is checked after the permission check

These are separate rules, applied after `authorize` passes:

- **Competition phase.** For example, uploads are only allowed while the competition is open,
  and rating only during judging. The phase decides *when*, the permission decides *who*.
- **Jury scope.** What a jury member sees and rates under `jury:rate` is filtered in the query
  to the invite's topic, class or device group. The scope is not encoded in permission names.

### Invariants

- Every organization has exactly one owner.
- Nobody can remove or demote the owner. Ownership changes only through a transfer, which is
  not built yet.
- Nobody can change their own role.
- Nobody can grant a permission they don't have.
- `superadmin` is never set or changed through the API.

## Consequences

- Routes read as "needs `competitions:write`", not as a list of roles. Adding a role touches
  `permissions.ts` and its test, nothing else.
- Cross-tenant access is closed by construction, because the scope comes from the database row.
- Every procedure has to name its permission, including read-only ones. That is a bit more
  typing per route, in exchange for a test that catches a forgotten check.
- Jury members never get accounts in this design. If they should sign in later, they become
  users with a competition-level membership, and `JURY_PERMISSIONS` becomes that role's set.

## Alternatives considered

- **Check roles in each route (the old app).** Rejected for the reasons in Context.
- **Better Auth's organization plugin with its access-control statements.** It brings its own
  organization, member and invitation tables, has no notion of competitions or token-based jury
  access, and would tie the domain model to the auth library.
- **Encode jury scope in permissions (`jury:rate:topic:<id>`).** Makes the permission list
  unbounded and moves data into the spec. A query filter does the same job.
- **Separate permission lists per level (organization, competition).** Not needed while the
  only competition-level caller is the jury. One list keeps `authorize` simple.

## Open questions

- Do jury members keep the token link with no account, or sign in? This ADR assumes the token,
  as in the old app.
- Does `owner` need any permission of its own once billing exists?
