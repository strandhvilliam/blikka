# ADR-0009: A competition has no mode, and one function decides which topics a participant can shoot

- **Status**: Proposed
- **Area**: API and website (`v3`)
- **Date**: 2026-11-14

## Context

A v3 competition has a name and a slug and nothing else. Organizers can't set one up yet, and
participant entry (ADR-0004) needs to know what a participant shoots and when.

Blikka is for any photo event, not only marathons. The ones we want to run differ in how they are
structured:

- A photo marathon shows 8 or 24 topics at the start, and each participant delivers one photo per
  topic in their class.
- A live by-camera event reveals topics one at a time, each open for its own window.
- A topic-by-topic event unlocks the next topic once you have submitted to the previous one,
  sometimes with a time limit per topic.
- A club night or open competition has one theme and takes a few photos per person.

The old app stored this as `marathons.mode` (`marathon` or `by-camera`) and branched on it. There
are 346 `by-camera` checks across `apps/` and `packages/`. Every feature asks which kind of event
it is in, and a third kind would have added a branch to each of them.

These events differ along a few independent settings: which topics there are, when each one is
open, whether they unlock in order, and how many photos a topic takes. Every format above is a
combination of those.

## Decision

### No mode

`competitions` has no `mode` or `type` column. Every format uses the same tables with different
values, and code never asks which format a competition is.

### Tables

`competitions` gains:

- `description` and `time_zone`. Organizers schedule in local time, and the website shows times
  in the competition's zone.
- `published_at`. Null is a draft that participants can't see or enter.
- `opens_at` and `closes_at`, the window in which photos can be submitted. A topic without its own
  window uses this one. A null `opens_at` means not open yet and a null `closes_at` means no
  deadline, so an organizer can open and close submissions by hand, which sets the field to now.
  Entering is allowed from `published_at` until `closes_at`, so a marathon can take sign-ups weeks
  before the day.
- `max_photos_per_topic`, default 1.
- `topics_in_sequence`, default false. When true, a participant's next topic unlocks once they
  have submitted to the previous one.
- `minutes_per_topic`, nullable. A time limit per topic, counted from when that topic unlocked for
  the participant.

`topics` has `competition_id`, `name`, `position` and a nullable `opens_at` and `closes_at`. A null
window means the competition's. A competition needs at least one topic to be published, and its
last topic can't be deleted while it is published. An event without a theme gets a single one,
such as "Open". Topics are a flat resource (ADR-0006).

`classes` is optional. A class has a `name`, a `description` and a range of topics (first position
and count). A participant picks one on entry. A competition without classes gives every
participant every topic.

`categories` is optional and replaces the old device groups. It is a named list a participant
picks one item from on entry, such as phone or camera, or youth or adult. Judging and exports can
split by it.

`submissions` each belong to one participant and one topic. A participant can replace a
submission but not delete it.

### One function decides availability

```
availableTopics(competition, participant, submissions, now)
```

The participant topics endpoint, the upload check and the participant pages all call it, and
nothing else decides whether a topic is available. A topic is available to a participant when:

1. its window is open, its own or the competition's,
2. it is in the participant's class range, if the competition has classes,
3. with `topics_in_sequence`, the participant has submitted to the previous topic or the previous
   topic's time ran out,
4. with `minutes_per_topic`, no more than that many minutes have passed since it unlocked for
   them. It never stays open past its window.

A topic whose time runs out is marked missed and the next one unlocks, so a participant is never
stuck.

### Unlock times come from data we already store

There is no progress table. The first topic unlocks when the participant entered or when the window
opens, whichever is later. Each later topic unlocks at the participant's upload to the previous
topic or at that topic's deadline, whichever comes first. A submission counts once its upload has
finished, before any checks run on it, so a slow check never holds a participant back.

### What participants see

Every topic's position and the total ("Topic 3 of 8"), each marked done, open, locked or missed.
The server leaves out the names of locked topics, so they can't be read from the network.
Organizers see every topic.

### The setup asks about settings, not formats

There are no formats or templates. Creating an event is a page of questions, one per setting, and
the answers together make the format. Each question uses the same words as its field in Settings,
and a question only appears when it applies:

1. What's the event called?
2. What will participants photograph? One topic is a single theme and skips the next two.
3. How do the topics open? All at once (like a photo marathon), one at a time after the previous
   is done (`topics_in_sequence`), or one at a time on a schedule or by hand (topic windows).
4. Time limit per topic? Only for "after the previous is done" (`minutes_per_topic`).
5. When can photos be submitted? Dates, or opened and closed by hand.
6. Do participants pick a class, and a category?

Question 3 sets two settings with one answer. The rarer combination of sequence and topic windows
is still reachable in Settings. The browser keeps the answers until the last step, and one
`POST /competitions` creates the competition with its topics in a transaction, so an abandoned
setup leaves nothing behind.

Features the old app tied to the marathon (contact sheets, the verification mode, staff laptop
upload) become settings an organizer turns on, not parts of a mode.

### Built in slices

The first slice is `published_at`, `opens_at`, `closes_at`, `topics`, and an `availableTopics` that
only checks the competition's window. Topic windows, sequence, time per topic, more photos per
topic, classes and categories each come later as a column with a default or a new table, and each
one extends `availableTopics`. None of them rewrites existing rows.

## Consequences

- A new format is usually a new combination of answers and needs no code. It needs code only when
  it brings a new kind of unlock, and then the change goes in `availableTopics` and its tests.
- `availableTopics` carries every combination of windows, classes, sequence and time limits, so its
  tests have to cover those combinations. It is the one place the old app's 346 checks collapse
  into.
- Hiding locked topics is the server's job. Any new endpoint that returns topics to a participant
  must go through `availableTopics`.
- Because unlocking reads submissions, deleting one would lock later topics again. That is why
  participants can replace a submission but not delete it.
- A submission always has a topic, so judging, exports and the gallery never handle a topicless
  case.

## Alternatives considered

- **A `mode` column.** Simple at first, and what the old app did. Every feature ends up branching
  on it, and formats that mix behaviors, such as sequence with per-topic windows, have no mode.
- **A progress table recording when each topic unlocked.** Easier to query, but it has to stay in
  sync with submissions and the clock. Everything it would hold can be computed from submissions,
  entry time and the windows.
- **Submissions without a topic for themeless events.** One fewer row for those events, but every
  feature that groups submissions by topic would need a second case.
- **Hiding locked topics in the website only.** The names would still be in the Api response.
- **Templates in the setup ("Photo marathon", "Live", "Topic by topic").** Familiar names, but a
  list to name and maintain, and combinations outside it have no template. Plain answers with an
  example ("All at once, like a photo marathon") give organizers the familiar word without one.

## Open questions

These don't change the model, only what gets built first:

- Whether a class can cover topics that aren't next to each other, or a participant can enter more
  than one class.
- Whether a category ever changes upload rules, such as a size limit for phones.
- Whether organizers open live topics by hand, on a schedule, or both. Opening by hand would set
  the topic's `opens_at` to now.
