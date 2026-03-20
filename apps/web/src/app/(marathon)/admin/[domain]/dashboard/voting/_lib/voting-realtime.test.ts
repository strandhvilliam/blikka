import { describe, expect, it } from "vitest";
import type { RouterOutputs } from "@blikka/api/trpc";
import {
  applyVotingLeaderboardRealtimeBatch,
  applyVotingSummaryRealtimeBatch,
  applyVotingVotersPageRealtimeBatch,
  dedupeVotingVoteCastEvents,
  parseVotingVoteCastEventData,
  type VotingVoteCastEventData,
} from "./voting-realtime";

type VotingAdminSummaryData = RouterOutputs["voting"]["getVotingAdminSummary"];
type VotingLeaderboardPageData =
  RouterOutputs["voting"]["getVotingLeaderboardPage"];
type VotingVotersPageData = RouterOutputs["voting"]["getVotingVotersPage"];

function makeVoteEvent(
  overrides: Partial<VotingVoteCastEventData> = {},
): VotingVoteCastEventData {
  return {
    eventId: "42:2026-03-17T12:00:00.000Z",
    domain: "demo",
    topicId: 7,
    sessionId: 42,
    submissionId: 99,
    votedAt: "2026-03-17T12:00:00.000Z",
    participantReference: "1234",
    participantFirstName: "Ada",
    participantLastName: "Lovelace",
    submissionCreatedAt: "2026-03-17T11:00:00.000Z",
    submissionKey: "submission-key",
    submissionThumbnailKey: "thumb-key",
    ...overrides,
  };
}

function makeSummary(): VotingAdminSummaryData {
  return {
    topic: {
      id: 7,
      name: "Topic",
      orderIndex: 1,
      activatedAt: null,
    },
    votingWindow: {
      startsAt: "2026-03-17T10:00:00.000Z",
      endsAt: null,
    },
    sessionStats: {
      total: 10,
      completed: 3,
      pending: 7,
      participantSessions: 8,
      manualSessions: 2,
    },
    voteStats: {
      totalVotes: 3,
    },
    submissionStats: {
      submissionCount: 12,
      eligibleSubmissionCount: 12,
      participantWithSubmissionCount: 10,
    },
    currentRound: {
      id: 1,
      roundNumber: 1,
      kind: "initial",
      startedAt: "2026-03-17T10:00:00.000Z",
      endsAt: null,
      sourceRoundId: null,
    },
    leadingTie: null,
    canStartTiebreak: false,
    topRanks: [
      {
        rank: 1,
        entries: [],
      },
    ],
  };
}

function makeLeaderboardPage(): VotingLeaderboardPageData {
  return {
    items: [
      {
        rank: 1,
        submissionId: 99,
        submissionCreatedAt: "2026-03-17T11:00:00.000Z",
        submissionKey: "submission-key",
        submissionThumbnailKey: "thumb-key",
        participantId: 100,
        participantFirstName: "Ada",
        participantLastName: "Lovelace",
        participantReference: "1234",
        voteCount: 3,
        tieSize: 1,
        isTie: false,
      },
      {
        rank: 2,
        submissionId: 100,
        submissionCreatedAt: "2026-03-17T11:05:00.000Z",
        submissionKey: "submission-key-2",
        submissionThumbnailKey: "thumb-key-2",
        participantId: 101,
        participantFirstName: "Grace",
        participantLastName: "Hopper",
        participantReference: "5678",
        voteCount: 2,
        tieSize: 1,
        isTie: false,
      },
    ],
    total: 2,
    page: 1,
    limit: 50,
    pageCount: 1,
  };
}

function makeVotersPage(): VotingVotersPageData {
  return {
    items: [
      {
        sessionId: 42,
        firstName: "Linus",
        lastName: "Torvalds",
        email: "linus@example.com",
        token: "vote-token",
        phoneNumber: null,
        notificationLastSentAt: null,
        connectedParticipantId: 88,
        votedAt: null,
        voteSubmission: null,
      },
      {
        sessionId: 43,
        firstName: "Margaret",
        lastName: "Hamilton",
        email: "margaret@example.com",
        token: "vote-token-2",
        phoneNumber: null,
        notificationLastSentAt: null,
        connectedParticipantId: null,
        votedAt: null,
        voteSubmission: null,
      },
    ],
    total: 2,
    page: 1,
    limit: 50,
    pageCount: 1,
  };
}

describe("voting-realtime", () => {
  it("parses object and JSON string payloads", () => {
    const event = makeVoteEvent();

    expect(parseVotingVoteCastEventData(event)).toEqual(event);
    expect(parseVotingVoteCastEventData(JSON.stringify(event))).toEqual(event);
  });

  it("ignores malformed payloads safely", () => {
    expect(parseVotingVoteCastEventData("not-json")).toBeNull();
    expect(parseVotingVoteCastEventData({ topicId: 7 })).toBeNull();
  });

  it("deduplicates repeated vote events and bounds tracked ids", () => {
    const firstEvent = makeVoteEvent();
    const secondEvent = makeVoteEvent({
      eventId: "43:2026-03-17T12:00:01.000Z",
      sessionId: 43,
    });

    const result = dedupeVotingVoteCastEvents(
      new Set(["old-event"]),
      [firstEvent, firstEvent, secondEvent],
      2,
    );

    expect(result.events).toEqual([firstEvent, secondEvent]);
    expect([...result.trackedEventIds]).toEqual([
      firstEvent.eventId,
      secondEvent.eventId,
    ]);
  });

  it("increments summary counters without touching top-rank data", () => {
    const summary = makeSummary();
    const updated = applyVotingSummaryRealtimeBatch(summary, [
      makeVoteEvent(),
      makeVoteEvent({
        eventId: "43:2026-03-17T12:00:01.000Z",
        sessionId: 43,
      }),
    ]);

    expect(updated?.voteStats.totalVotes).toBe(5);
    expect(updated?.sessionStats.completed).toBe(5);
    expect(updated?.sessionStats.pending).toBe(5);
    expect(updated?.topRanks).toBe(summary.topRanks);
  });

  it("patches the voters page when the voted session is visible", () => {
    const updated = applyVotingVotersPageRealtimeBatch(makeVotersPage(), [
      makeVoteEvent(),
    ]);

    expect(updated?.items[0]?.votedAt).toBe("2026-03-17T12:00:00.000Z");
    expect(updated?.items[0]?.voteSubmission).toEqual({
      submissionId: 99,
      participantReference: "1234",
      participantFirstName: "Ada",
      participantLastName: "Lovelace",
      thumbnailKey: "thumb-key",
      key: "submission-key",
      createdAt: "2026-03-17T11:00:00.000Z",
    });
    expect(updated?.items[1]?.voteSubmission).toBeNull();
  });

  it("increments leaderboard vote counts without recomputing ranking fields", () => {
    const page = makeLeaderboardPage();
    const updated = applyVotingLeaderboardRealtimeBatch(page, [
      makeVoteEvent(),
      makeVoteEvent({
        eventId: "43:2026-03-17T12:00:01.000Z",
        sessionId: 43,
      }),
    ]);

    expect(updated?.items[0]?.voteCount).toBe(5);
    expect(updated?.items[0]?.rank).toBe(page.items[0]?.rank);
    expect(updated?.items[0]?.tieSize).toBe(page.items[0]?.tieSize);
    expect(updated?.items[0]?.isTie).toBe(page.items[0]?.isTie);
    expect(updated?.items[1]).toEqual(page.items[1]);
  });
});
