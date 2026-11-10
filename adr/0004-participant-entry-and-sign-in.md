# ADR-0004: Participants enter through one flow, as a guest or with Google, and own their entry by session or guest token

- **Status**: Proposed
- **Area**: API and website (`apps/blikka`)
- **Date**: 2026-11-10

## Context

Most participants are not technical. They enter on their phone at the event, often over mobile
data, and every step that can fail there becomes a support request for the organizer and for us.
Many of them come back week after week, and for them retyping the same details each time is the
main friction.

ADR-0001 says a participant is not a role: they own their own entry, through
`participants.user_id` or a guest upload token, and participant routes check ownership. It does
not say how a guest gets that token, how a guest entry relates to an account, or which sign-in
methods participants see. The `participants` table already allows guests (`user_id` is null) and
has a unique `(competition_id, email)`. v3 has no participant routes yet, so we can settle this
before building them.

## Decision

### One entry flow for guests and signed-in participants

There is one set of participant routes and one set of participant pages. What a participant does
after entering (upload, submit, see status) is the same code whether they are a guest or signed
in. The only fork is at entry:

| | Signed in | Guest |
|---|---|---|
| Name and email | Taken from the account. Anything in the request body is ignored | Typed in the form, required |
| `participants.user_id` | The user | Null |
| Proves ownership with | The session | The guest token returned on entry |

Emails are stored lowercased, so the unique `(competition_id, email)` cannot be bypassed by
case.

### Ownership is checked in one place

Every participant route after entry calls one helper, `requireParticipantOwner(participantId)`.
It passes when the session user is the row's `user_id`, or when the request carries the row's
guest token. Phase rules from ADR-0001 (uploads only while the competition is open) still apply
after it.

- The guest token is random, returned once on entry and kept by the website in the browser on
  that device. Only its SHA-256 hash is stored, in a nullable `participants.guest_token_hash`
  column. Revoking it sets the column to null.
- It is sent in its own `X-Participant-Token` header. `Authorization: Bearer` is already the
  Better Auth session token (README, Auth), and the two must not be confused.

### A verified email takes over a guest entry

Guests never confirm their email. When a signed-in user enters a competition where a guest row
with their verified email already exists, they do not get "email already taken". They take over
that row:

1. `user_id` is set to the user.
2. `guest_token_hash` is set to null, so whoever holds the guest token loses access.
3. Uploads already on the row stay. The user keeps or replaces them.

Usually the guest and the user are the same person, who simply continues. If someone else
entered with their email first, the real owner gets the entry back and replaces the uploads. An
organizer can delete the entry when that is not enough.

Google always provides a verified email, so this works for every signed-in participant.

### Sign-in methods per audience

| Audience | Shown | Why |
|---|---|---|
| Participants (`_public/` pages) | Google, and "continue as guest" | No code to wait for at the event. Anyone without Google enters as a guest, so nobody is locked out |
| Organizers (`/login`) | Google, with email OTP as fallback | Many clubs and municipalities use Microsoft or their own domain. Without OTP they cannot sign in at all |
| Jury | Neither | Invite token, as in ADR-0001 |
| Local dev | Email OTP, Google optional | The code is logged in the terminal, so dev needs no Google credentials |

Email OTP stays enabled in the Api. Not showing it to participants is a choice in the website,
not a restriction: the endpoint stays reachable.

### Returning guests do not retype their details

The website remembers a guest's name and email in the browser and fills in the entry form next
time on the same device. This is a convenience with no auth meaning. The Api still treats each
entry as a new guest.

## Consequences

- Upload, submission and status logic exist once. Adding a sign-in method touches entry and
  `requireParticipantOwner`, nothing else.
- A guest who clears their browser or changes phone loses access to their entry until they
  sign in with Google using the same email (which takes it over) or ask the organizer.
- Someone can block a person's email in a competition by entering with it first. The takeover
  undoes it once the owner signs in. A guest-only owner has to ask the organizer.
- Participants without Google stay guests. They retype their details on a new device and have no
  history across competitions.

## Alternatives considered

- **Separate routes for guests and signed-in participants.** The same upload and status logic in
  two places, which drift apart. The difference is a few lines in one ownership check.
- **Email OTP for guests too.** Removes email squatting, but puts a code that may land late or in
  spam in front of every participant at the event, to stop something rare and low-stakes.
- **Drop email OTP entirely.** Locks out organizers without Google, and local dev would need
  Google credentials again.
- **Guest token as `Authorization: Bearer`.** Collides with the Better Auth session token, which
  already uses that header.

## Open questions

- Sign in with Apple. Many participants are on iPhones without a Google account. Add it when
  support requests show they want an account, not before.
- A per-competition "require verified email" setting, for competitions with prizes where entering
  as someone else matters. Not needed yet.
- Should signing in also take over guest entries in past competitions with the same verified
  email, to give returning participants their history? This ADR only takes over on entry.
