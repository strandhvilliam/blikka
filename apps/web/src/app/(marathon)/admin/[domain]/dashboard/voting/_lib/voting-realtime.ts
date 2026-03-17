"use client";

import type { RouterOutputs } from "@blikka/api/trpc";
import { z } from "zod";

const votingVoteCastEventDataSchema = z.object({
  eventId: z.string(),
  domain: z.string(),
  topicId: z.number(),
  sessionId: z.number(),
  submissionId: z.number(),
  votedAt: z.string(),
  participantReference: z.string().nullable(),
  participantFirstName: z.string().nullable(),
  participantLastName: z.string().nullable(),
  submissionCreatedAt: z.string(),
  submissionKey: z.string().nullable(),
  submissionThumbnailKey: z.string().nullable(),
});

export type VotingVoteCastEventData = z.infer<
  typeof votingVoteCastEventDataSchema
>;

export type VotingAdminSummaryData =
  RouterOutputs["voting"]["getVotingAdminSummary"];
export type VotingLeaderboardPageData =
  RouterOutputs["voting"]["getVotingLeaderboardPage"];
export type VotingVotersPageData = RouterOutputs["voting"]["getVotingVotersPage"];

export function parseVotingVoteCastEventData(
  raw: unknown,
): VotingVoteCastEventData | null {
  const parsedData =
    typeof raw === "string"
      ? (() => {
          try {
            return JSON.parse(raw) as unknown;
          } catch {
            return null;
          }
        })()
      : raw;

  const parsed = votingVoteCastEventDataSchema.safeParse(parsedData);
  return parsed.success ? parsed.data : null;
}

export function dedupeVotingVoteCastEvents(
  trackedEventIds: ReadonlySet<string>,
  incomingEvents: readonly VotingVoteCastEventData[],
  maxTrackedEventIds: number,
): {
  trackedEventIds: ReadonlySet<string>;
  events: VotingVoteCastEventData[];
} {
  let nextTrackedEventIds: ReadonlySet<string> | Set<string> = trackedEventIds;
  const events: VotingVoteCastEventData[] = [];

  const ensureMutableTrackedEventIds = (): Set<string> => {
    if (nextTrackedEventIds === trackedEventIds) {
      nextTrackedEventIds = new Set(trackedEventIds);
    }

    return nextTrackedEventIds as Set<string>;
  };

  for (const event of incomingEvents) {
    if (nextTrackedEventIds.has(event.eventId)) {
      continue;
    }

    ensureMutableTrackedEventIds().add(event.eventId);
    events.push(event);
  }

  if (nextTrackedEventIds !== trackedEventIds) {
    const mutableTrackedEventIds = nextTrackedEventIds as Set<string>;

    while (mutableTrackedEventIds.size > maxTrackedEventIds) {
      const oldestEventId = mutableTrackedEventIds.values().next().value;
      if (oldestEventId === undefined) {
        break;
      }
      mutableTrackedEventIds.delete(oldestEventId);
    }
  }

  return {
    trackedEventIds: nextTrackedEventIds,
    events,
  };
}

export function applyVotingSummaryRealtimeBatch(
  summary: VotingAdminSummaryData | undefined,
  voteEvents: readonly VotingVoteCastEventData[],
): VotingAdminSummaryData | undefined {
  if (!summary || voteEvents.length === 0) {
    return summary;
  }

  const batchCount = voteEvents.length;

  return {
    ...summary,
    sessionStats: {
      ...summary.sessionStats,
      completed: summary.sessionStats.completed + batchCount,
      pending: Math.max(0, summary.sessionStats.pending - batchCount),
    },
    voteStats: {
      ...summary.voteStats,
      totalVotes: summary.voteStats.totalVotes + batchCount,
    },
  };
}

export function applyVotingVotersPageRealtimeBatch(
  page: VotingVotersPageData | undefined,
  voteEvents: readonly VotingVoteCastEventData[],
): VotingVotersPageData | undefined {
  if (!page || voteEvents.length === 0) {
    return page;
  }

  const eventsBySessionId = new Map(
    voteEvents.map((event) => [event.sessionId, event] as const),
  );

  let didChange = false;
  const items = page.items.map((item) => {
    const voteEvent = eventsBySessionId.get(item.sessionId);
    if (!voteEvent) {
      return item;
    }

    const nextVoteSubmission = {
      submissionId: voteEvent.submissionId,
      participantReference: voteEvent.participantReference,
      participantFirstName: voteEvent.participantFirstName,
      participantLastName: voteEvent.participantLastName,
      thumbnailKey: voteEvent.submissionThumbnailKey,
      key: voteEvent.submissionKey ?? item.voteSubmission?.key ?? "",
      createdAt: voteEvent.submissionCreatedAt,
    };

    const isUnchanged =
      item.votedAt === voteEvent.votedAt &&
      item.voteSubmission?.submissionId === nextVoteSubmission.submissionId &&
      item.voteSubmission?.participantReference ===
        nextVoteSubmission.participantReference &&
      item.voteSubmission?.participantFirstName ===
        nextVoteSubmission.participantFirstName &&
      item.voteSubmission?.participantLastName ===
        nextVoteSubmission.participantLastName &&
      item.voteSubmission?.thumbnailKey === nextVoteSubmission.thumbnailKey &&
      item.voteSubmission?.key === nextVoteSubmission.key &&
      item.voteSubmission?.createdAt === nextVoteSubmission.createdAt;

    if (isUnchanged) {
      return item;
    }

    didChange = true;

    return {
      ...item,
      votedAt: voteEvent.votedAt,
      voteSubmission: nextVoteSubmission,
    };
  });

  return didChange ? { ...page, items } : page;
}

export function applyVotingLeaderboardRealtimeBatch(
  page: VotingLeaderboardPageData | undefined,
  voteEvents: readonly VotingVoteCastEventData[],
): VotingLeaderboardPageData | undefined {
  if (!page || voteEvents.length === 0) {
    return page;
  }

  const voteCountsBySubmissionId = new Map<number, number>();

  for (const voteEvent of voteEvents) {
    const currentCount = voteCountsBySubmissionId.get(voteEvent.submissionId) ?? 0;
    voteCountsBySubmissionId.set(voteEvent.submissionId, currentCount + 1);
  }

  let didChange = false;
  const items = page.items.map((item) => {
    const increment = voteCountsBySubmissionId.get(item.submissionId);
    if (!increment) {
      return item;
    }

    didChange = true;

    return {
      ...item,
      voteCount: item.voteCount + increment,
    };
  });

  return didChange ? { ...page, items } : page;
}
