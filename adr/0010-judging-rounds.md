# ADR-0010: Judging and voting are one model: a round with a pool, voters and a method

- **Status**: Proposed
- **Area**: API and website (`v3`)
- **Date**: 2026-11-18

## Context

The old app has two systems for picking winners:

- **Voting** (`voting_session`, `voting_round`, `voting_round_submission`, `voting_round_vote`).
  Participants pick one submission per topic. A tiebreak is a hard-coded second round kind.
- **Jury** (`jury_invitations`, `jury_ratings`, `jury_shortlist_picks`). Invited jurors give each
  entry 1 to 5 stars, or make a shortlist with one winner. Each invitation has its own scope: a
  topic, a class, a device group or everything.

Each system has its own invites, scope filter, lifecycle and leaderboard. A new use case, such as
a top-3 pick or a final round over a shortlist, would need a third copy. Jury ratings are keyed to
the participant, not the submission, which is ambiguous once a participant has more than one photo.

v3 has topics and submissions (ADR-0009) and no judging yet.

## Decision

### One model

A **round** is one judging or voting pass over a set of submissions. It answers four questions:

| Question | Column | Values |
|---|---|---|
| Which submissions? | `topic_id`, or `source_round_id` | One topic, all topics, or chosen entries of an earlier round |
| Who votes? | `voters` | `jury` (invited by email) or `participants` |
| What does a voter record? | `method` and its settings | `pick` (up to `max_votes`, with an optional favorite) or `rating` (1 to `scale`) |
| When? | `opens_at`, `closes_at` | Null `opens_at` is a draft |

The current use cases are combinations of these values:

| Use case | Round |
|---|---|
| Peer vote per topic | `pick`, `max_votes` 1, participants, one topic |
| Tiebreak | `pick`, `max_votes` 1, `source_round_id` set, the tied entries |
| Jury stars | `rating`, `scale` 5, jury |
| Jury shortlist and winner | `pick`, `max_votes` 10, `favorite`, jury |

### Tables

- `judging_rounds`: the four answers above, plus `name`, `competition_id` and `deleted_at`. The
  method settings are plain columns (`max_votes`, `favorite`, `scale`) with a check constraint per
  method, not JSON, so the database enforces them.
- `judging_entries`: `(round_id, submission_id)`. The pool is copied here when the round opens, so a
  submission added or moved during voting doesn't change the round. A round made from an earlier
  round gets its entries when it is created.
- `judging_voters`: one row per voter per round. A juror has `email`, `name` and `token_hash`. A
  participant voter has `participant_id`. One email can be a voter in many rounds, each with its
  own link, as one email could have many jury invitations in the old app.
- `judging_votes`: `(voter_id, submission_id)`, `value`, `favorite`, `note`. A pick stores value 1.
  A partial unique index allows one favorite per voter.

### Opening and closing

Opening sets `opens_at` to now and copies the pool. There is no scheduled opening, because the pool
is copied at that moment and nothing runs in the background yet. `closes_at` is set when opening or
later, and setting it to now closes the round. Clearing it reopens the round. The state is read from
the two timestamps. There is no status column to keep in sync with them.

### Results are a query

Results are counted on read: votes and favorites per entry for `pick`, the average for `rating`.
Votes can't change after a round closes, so the same query gives the same answer. There is no
results table and no job. Ranking is a pure function (`rounds/rank.ts`) so ties are tested without
a database: `pick` ranks by favorites, then votes, and `rating` by average, then the number of
ratings. Votes from a revoked voter or a deleted participant don't count, and nor do entries of a
deleted participant.

A round's winners are not stored. Awards, and results shown to participants, come later.

### Voters

A voter is not a role. Like a participant (ADR-0004), a voter acts by owning a `judging_voters`
row:

- A juror sends the link token (`blikka_jvt_…`) as a bearer token. Only its hash is stored.
- A participant uses their session or guest token. Their voter row is created the first time they
  list their ballots while a participants round is open, so people who enter late can still vote.
  Their own submissions are left out of their ballot.

The `/ballots` endpoints serve both through one `BallotSession` middleware. A **ballot** is a
voter's view of a round: its entries and their votes.

### Vote limits are locked

Casting a vote locks the voter row (`select … for update`) before counting the voter's votes, so two
requests at once can't both pass "fewer than `max_votes`". With `max_votes` 1, a new pick replaces
the old one. Setting a favorite clears the voter's other favorite.

### Permissions

`jury:read`, `jury:write` and `jury:rate` become `judging:read` and `judging:write`, both for
organizers. The jury caller in ADR-0001 is replaced by the ownership check above.

### Photos

Submissions have no files yet, so a ballot shows each entry by number and topic. Voters never see
who took a photo. Organizers see names in the results.

## Consequences

- A new use case is usually new values, not new tables. A new method needs a column with a check,
  a branch in vote validation and a branch in `rank`.
- Two methods cover what the old app does. Ranked choice and criteria scoring are not built.
- A juror in three rounds gets three links. A `judges` table per competition can give them one
  link later without changing rounds.
- Results across rounds, such as jury and public combined, are not modeled. Each round's results
  stand alone.

## Alternatives considered

- **Keep voting and jury separate (the old app).** Rejected for the reasons in Context.
- **Method settings as JSON.** Flexible, but every read has to parse it and the database can't
  check it. Two methods fit in three columns.
- **A stored results table, written by a job on close.** Needed only for methods too slow to count
  on read. Count and average are one `GROUP BY`.
- **Scope per voter, as the old jury invitations had.** Each voter would need their own pool. A
  round per scope keeps one pool per round and one place that copies it.
- **One token for all of a juror's rounds.** One link is easier, but a leaked link opens every
  round. It can come later with a `judges` table.
