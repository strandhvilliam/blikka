"use client";

import { startTransition, useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getDomainRealtimeChannel,
  getRealtimeChannelEnvironmentFromNodeEnv,
  getVotingVoteCastEventName,
} from "@blikka/realtime/contract";
import { useDebouncedInvalidate } from "@/hooks/use-debounced-invalidate";
import { useRealtime } from "@/lib/realtime-client";
import { useTRPC } from "@/lib/trpc/client";
import { VOTING_PAGE_SIZE } from "../_lib/utils";
import {
  applyVotingLeaderboardRealtimeBatch,
  applyVotingSummaryRealtimeBatch,
  applyVotingVotersPageRealtimeBatch,
  dedupeVotingVoteCastEvents,
  parseVotingVoteCastEventData,
  type VotingAdminSummaryData,
  type VotingLeaderboardPageData,
  type VotingVoteCastEventData,
  type VotingVotersPageData,
} from "../_lib/voting-realtime";

const REALTIME_CHANNEL_ENV = getRealtimeChannelEnvironmentFromNodeEnv(
  typeof process !== "undefined" ? process.env.NODE_ENV : undefined,
);

const VOTING_VOTE_CAST_EVENT = getVotingVoteCastEventName();
const VOTING_REALTIME_BATCH_WINDOW_MS = 250;
const VOTING_REALTIME_RECONCILE_DEBOUNCE_MS = 1000;
const MAX_PENDING_VOTING_REALTIME_EVENTS = 200;
const MAX_TRACKED_VOTING_REALTIME_EVENT_IDS = 1000;

interface UseVotingRealtimeOptions {
  domain: string;
  topicId: number;
  leaderboardPage: number;
  votersPage: number;
}

export function useVotingRealtime({
  domain,
  topicId,
  leaderboardPage,
  votersPage,
}: UseVotingRealtimeOptions) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const trackedEventIdsRef = useRef<ReadonlySet<string>>(new Set());
  const queuedVoteEventsRef = useRef<VotingVoteCastEventData[]>([]);
  const batchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueOverflowedRef = useRef(false);

  const channel = useMemo(
    () => getDomainRealtimeChannel(REALTIME_CHANNEL_ENV, domain),
    [domain],
  );

  const summaryQueryOptions = useMemo(
    () =>
      trpc.voting.getVotingAdminSummary.queryOptions({
        domain,
        topicId,
      }),
    [domain, topicId, trpc],
  );

  const leaderboardQueryOptions = useMemo(
    () =>
      trpc.voting.getVotingLeaderboardPage.queryOptions({
        domain,
        topicId,
        page: leaderboardPage,
        limit: VOTING_PAGE_SIZE,
      }),
    [domain, leaderboardPage, topicId, trpc],
  );

  const votersQueryOptions = useMemo(
    () =>
      trpc.voting.getVotingVotersPage.queryOptions({
        domain,
        topicId,
        page: votersPage,
        limit: VOTING_PAGE_SIZE,
      }),
    [domain, topicId, trpc, votersPage],
  );

  const invalidateSummary = useDebouncedInvalidate(
    queryClient,
    summaryQueryOptions.queryKey,
    VOTING_REALTIME_RECONCILE_DEBOUNCE_MS,
  );
  const invalidateLeaderboard = useDebouncedInvalidate(
    queryClient,
    leaderboardQueryOptions.queryKey,
    VOTING_REALTIME_RECONCILE_DEBOUNCE_MS,
  );
  const invalidateVoters = useDebouncedInvalidate(
    queryClient,
    votersQueryOptions.queryKey,
    VOTING_REALTIME_RECONCILE_DEBOUNCE_MS,
  );

  useEffect(() => {
    return () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = null;
    }
    queuedVoteEventsRef.current = [];
    queueOverflowedRef.current = false;
  }, [domain, topicId, leaderboardPage, votersPage]);

  useRealtime({
    events: [VOTING_VOTE_CAST_EVENT],
    channels: [channel],
    enabled: Boolean(domain) && topicId > 0,
    onData: ({ data: rawData }) => {
      const voteEvent = parseVotingVoteCastEventData(rawData);
      if (!voteEvent || voteEvent.topicId !== topicId) {
        return;
      }

      const dedupedEvents = dedupeVotingVoteCastEvents(
        trackedEventIdsRef.current,
        [voteEvent],
        MAX_TRACKED_VOTING_REALTIME_EVENT_IDS,
      );
      trackedEventIdsRef.current = dedupedEvents.trackedEventIds;

      if (dedupedEvents.events.length === 0) {
        return;
      }

      if (queueOverflowedRef.current) {
        if (!batchTimeoutRef.current) {
          batchTimeoutRef.current = setTimeout(() => {
            batchTimeoutRef.current = null;

            startTransition(() => {
              invalidateSummary();
              invalidateLeaderboard();
              invalidateVoters();
            });
          }, VOTING_REALTIME_BATCH_WINDOW_MS);
        }

        return;
      }

      if (
        queuedVoteEventsRef.current.length + dedupedEvents.events.length >
        MAX_PENDING_VOTING_REALTIME_EVENTS
      ) {
        queueOverflowedRef.current = true;
        queuedVoteEventsRef.current = [];
      } else {
        queuedVoteEventsRef.current.push(...dedupedEvents.events);
      }

      if (batchTimeoutRef.current) {
        return;
      }

      batchTimeoutRef.current = setTimeout(() => {
        batchTimeoutRef.current = null;

        const queuedVoteEvents = queuedVoteEventsRef.current;
        const queueOverflowed = queueOverflowedRef.current;

        queuedVoteEventsRef.current = [];
        queueOverflowedRef.current = false;

        startTransition(() => {
          if (!queueOverflowed && queuedVoteEvents.length > 0) {
            if (queryClient.getQueryState(summaryQueryOptions.queryKey)) {
              queryClient.setQueryData<VotingAdminSummaryData | undefined>(
                summaryQueryOptions.queryKey,
                (current) =>
                  applyVotingSummaryRealtimeBatch(current, queuedVoteEvents),
              );
            }

            if (queryClient.getQueryState(votersQueryOptions.queryKey)) {
              queryClient.setQueryData<VotingVotersPageData | undefined>(
                votersQueryOptions.queryKey,
                (current) =>
                  applyVotingVotersPageRealtimeBatch(current, queuedVoteEvents),
              );
            }

            if (queryClient.getQueryState(leaderboardQueryOptions.queryKey)) {
              queryClient.setQueryData<VotingLeaderboardPageData | undefined>(
                leaderboardQueryOptions.queryKey,
                (current) =>
                  applyVotingLeaderboardRealtimeBatch(
                    current,
                    queuedVoteEvents,
                  ),
              );
            }
          }

          invalidateSummary();
          invalidateLeaderboard();
          invalidateVoters();
        });
      }, VOTING_REALTIME_BATCH_WINDOW_MS);
    },
  });
}
