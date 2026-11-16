# ADR-0004: Participants enter through one flow, as a guest or with Google, and own their entry by session or guest token

- **Status**: Proposed
- **Area**: API and website (`v3`)
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
case. A user has at most one entry per competition, and an entry belongs to one competition: a
participant who comes back to the next event is a new entry under the same user.

### When an event can be entered

Only a published competition can be entered (ADR-0009), from `published_at` until `closes_at`, or
for as long as `closes_at` is null. Participants open it at `/e/<slug>`. A draft answers the same
404 as an event that doesn't exist. Once anyone has entered, the competition can't be unpublished,
so nobody loses an event they joined.

### Participants have their own routes, under `/entry`

Participants call the same flat resources as organizers (ADR-0006), under `/entry`, with their own
response shapes:

```
GET  /entry/competitions/:slug               a published competition
POST /entry/participants                     enter
GET  /entry/participants?competition_id=…    the caller's own entries
GET  /entry/participants/:id                 one of them
```

Submissions follow as `/entry/submissions`. A path never means one thing to an organizer and
another to a participant, and the two views of the same rows can grow apart.

### Ownership is checked in one place

Every `/entry` route reads through one scope: the rows whose `user_id` is the session's user, or
whose `guest_token_hash` matches the request's guest token. A caller with neither owns nothing.
`requireParticipantOwner(caller, participantId)` is that scope for one row, and a 404 otherwise.
Phase rules from ADR-0001 (uploads only while the competition is open) still apply after it.

Listing the caller's entries in a competition replaces remembering an entry id, so a signed-in
participant finds their entry on any device.

- The guest token is random, prefixed `blikka_pgt_`, returned once on entry and kept by the
  website in the browser on that device. Only its SHA-256 hash is stored, in a nullable
  `participants.guest_token_hash` column. Revoking it sets the column to null.
- It is sent as `Authorization: Bearer blikka_pgt_…`. The `/entry` routes pick it out by its
  prefix and keep it from Better Auth, which reads the same header for its session tokens
  (README, Auth). The website sends its session as a cookie, so one request can carry both.

### A verified email takes over a guest entry

Guests never confirm their email. When a signed-in user enters a competition where a guest row
with their verified email already exists, they do not get "email already taken". They take over
that row:

1. `user_id` is set to the user.
2. `name` is set to the account's name, unless the account has none.
3. `guest_token_hash` is set to null, so whoever holds the guest token loses access.
4. Uploads already on the row stay. The user keeps or replaces them.

Usually the guest and the user are the same person, who simply continues. If someone else
entered with their email first, the real owner gets the entry back and replaces the uploads. An
organizer can delete the entry when that is not enough.

Google and the emailed sign-in code both give a verified email, so this works for every
signed-in participant.

### Guests are one-offs until they sign in

A guest is never asked to confirm their email or make an account. Each entry stands alone, and a
participant who comes back as a guest makes a new one each time.

Whenever a session is created (Google or code), every guest entry with the user's verified email
becomes theirs, in every competition, by the takeover above. Entering signed in applies the same
claim, for a guest entry made after the session was. A competition where the user already has an
entry is skipped. So a participant who entered as a guest several times with the same email gets
all of those entries the first time they sign in, for example to see their history. Linking only
ever follows a verified email, so typing someone's address never joins their history.

### Sign-in methods per audience

| Audience | Shown | Why |
|---|---|---|
| Participants (`/e/<slug>`) | Google, and "continue as guest" | No code to wait for at the event. Anyone without Google enters as a guest, so nobody is locked out. They get an account, with their guest entries, whenever they sign in later |
| Organizers (`/login`) | Google, with email OTP as fallback | Many clubs and municipalities use Microsoft or their own domain. Without OTP they cannot sign in at all |
| Jury | Neither | Invite token, as in ADR-0001 |
| Local dev | Email OTP, Google optional | The code is logged in the terminal, so dev needs no Google credentials |

Email OTP stays enabled in the Api. Not showing it to participants is a choice in the website,
not a restriction: the endpoint stays reachable.

### A participant who already entered goes straight to their entry

Before showing "Google / continue as guest", `/e/<slug>` asks
`GET /entry/participants?competition_id=…` with whatever the browser holds: the session cookie,
and the guest token it kept for this competition. One call covers both, because the scope reads
either. If an entry comes back, the page opens it. Only an empty list shows the choice.

The website keeps one guest token per competition, since each guest entry has its own. A token
that no longer owns anything, because a sign-in claimed the entry, comes back as an empty list:
the website drops it and shows the choice, and signing in finds the entry.

### Returning guests do not retype their details

The website remembers a guest's name and email in the browser and fills in the entry form next
time on the same device. This is a convenience with no auth meaning. The Api still treats each
entry as a new guest.

## Consequences

- Upload, submission and status logic exist once. Adding a sign-in method touches entry and the
  `/entry` scope, nothing else.
- A guest who clears their browser or changes phone loses access to their entry until they sign
  in with the same email (which takes it over) or ask the organizer.
- Signing in anywhere while an event is running takes over that event's guest entry, so the
  browser that entered as a guest loses it. It is the same person, now signed in elsewhere.
- Someone can block a person's email in a competition by entering with it first. The owner gets
  the entry back by signing in.
- Participants without Google get an account, and their history across competitions, by signing
  in with an emailed code. Until they do, they are guests.

## Alternatives considered

- **Separate routes for guests and signed-in participants.** The same upload and status logic in
  two places, which drift apart. The difference is a few lines in one ownership check.
- **Email OTP for guests too.** Removes email squatting, but puts a code that may land late or in
  spam in front of every participant at the event, to stop something rare and low-stakes.
- **Drop email OTP entirely.** Locks out organizers without Google, and local dev would need
  Google credentials again.
- **One `/participants` for organizers and participants.** One path answering under two
  permission models: an organizer could list a row and then get a 404 for it, and both views of
  the same rows would have to share one shape.
- **Linking guest entries by email without confirming it.** Anyone typing your address would join
  your history, or see it.
- **Emailing every guest a sign-in link after entering.** Gives each guest an account straight
  away, but adds a flow at the event that nobody needs there, and opening the link in another
  browser takes the entry away from the one that entered. Linking can wait until someone signs in.
- **Guest token in its own `X-Participant-Token` header.** A second credential header next to
  `Authorization`, when the prefix already tells a guest token from a session token.

## Open questions

- Sign in with Apple. Many participants are on iPhones without a Google account. Add it when
  support requests show they want an account, not before.
- A per-competition "require verified email" setting, for competitions with prizes where entering
  as someone else matters. Not needed yet.
