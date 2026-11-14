# ADR-0007: An invitation is addressed to an email, and signing in with that email is what accepts it

- **Status**: Proposed
- **Area**: API (`v3`)
- **Date**: 2026-11-14

## Context

An organization needs more than its owner. Every member is an `admin` with `members:write`
(ADR-0001), so whoever joins gets full control of the organization and all of its competitions.
Getting the wrong person in is the risk to design against.

There are two common shapes:

- **Add the user directly.** Look up or create a user by email, insert the membership, and send
  an email saying they were added. No pending state.
- **A pending invitation** that becomes a membership when the invited person accepts it.

## Decision

### A pending invitation, with no token

`organization_invitations` holds `organization_id`, `email` (lowercase), `invited_by`,
`expires_at` (7 days), `accepted_at` and `revoked_at`. A partial unique index allows one open
invitation per organization and email. Inviting the same address again renews it instead of
adding a second row.

The invitation carries no secret. It belongs to whoever signs in with its email, once Better Auth
has marked that email verified (an email code or Google). Sign-in already proves the person owns
the address, so a token would only add something that can leak: a forwarded link gives nothing
to the person it was forwarded to.

### Two kinds of caller

- **Admins** create invitations under `members:write`, through `authorize` (ADR-0001). An address
  that is already a member gets a 409. Only `admin` can be invited. Ownership changes only through
  a transfer.
- **The invited person** has no role in the organization yet, so permissions don't apply. They
  reach their invitations by the email match alone: `GET /invitations/received` lists the open,
  unexpired ones for their verified email, and `POST /invitations/:id/accept` accepts one. An
  invitation that is someone else's, expired, revoked, already accepted or in a deleted
  organization is a 404, so the id gives nothing away. This is the same kind of rule as a
  participant owning their entry (ADR-0004): it is checked in the query, not by `authorize`.

`/invitations/received` is a separate path rather than a filter on `GET /invitations`, which
(ADR-0006) lists what an admin manages. Each path keeps one meaning and one access rule.

Accepting sets `accepted_at` and inserts the membership in one transaction. The update matches on
the open, addressed-to-you condition, so a second accept, including one running in parallel, finds
no row.

### Where the invited person sees it

There is no invitation page. Onboarding asks for a name if the account has none, then lists the
invitations, with a way to create their own organization instead. People who already belong to an
organization see their invitations in the org switcher. The invitation email (not built yet; the
Api logs the invitation instead) only has to say which address to sign in with.

## Consequences

- No user rows for people who never signed up, and a typo in the address grants nothing until
  someone verifies that address, and only for 7 days.
- Someone who signs in with a different address than the one invited sees no invitation. The
  email has to say which address to use.
- Rows are kept after acceptance or revocation, as a record of who invited whom.
- Sending real emails will need a rate limit per organization, like the one on sign-in codes.
  Until then there is nothing to abuse.

## Alternatives considered

- **Add the user directly (no pending state).** Simpler, but a typo makes a permanent admin for
  whoever later owns the address, creates users who never signed up, and joins people without
  asking them.
- **A token in the invitation link.** Needed only when the link is the proof. Here the verified
  email is, and a token adds a secret to store, expire and leak.
- **Better Auth's organization plugin invitations.** Rejected with the plugin in ADR-0001.
- **Accept automatically on sign-in.** Would join people to organizations they never chose.
