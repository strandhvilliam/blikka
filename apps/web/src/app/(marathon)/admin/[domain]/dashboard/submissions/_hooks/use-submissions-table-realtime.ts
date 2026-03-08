"use client";

import { useCallback, useMemo, useState } from "react";
import type {
  InfiniteData,
  QueryClient,
  QueryKey,
} from "@tanstack/react-query";
import { useDebouncedInvalidate } from "@/hooks/use-debounced-invalidate";
import {
  getDomainRealtimeChannel,
  getRealtimeResultEventName,
} from "@blikka/realtime/contract";
import { useRealtime } from "@/lib/realtime-client";
import type { TableData } from "./use-submissions-table";

const RESULT_EVENT = {
  uploadFlowInitializer: getRealtimeResultEventName("upload-flow-initialized"),
  submissionProcessed: getRealtimeResultEventName("submission-processed"),
  participantFinalized: getRealtimeResultEventName("participant-finalized"),
} as const;

const SUBSCRIBED_EVENTS = [
  RESULT_EVENT.uploadFlowInitializer,
  RESULT_EVENT.submissionProcessed,
  RESULT_EVENT.participantFinalized,
] as const;

const INITIALIZER_INVALIDATE_DEBOUNCE_MS = 750;
const TASK_ERROR_INVALIDATE_DEBOUNCE_MS = 750;
const FINALIZE_SAFETY_INVALIDATE_DEBOUNCE_MS = 10_000;
const MAX_TRACKED_REFERENCES = 1000;

function normalizeReference(reference: string): string {
  return reference.trim().toLowerCase();
}

function parseRealtimeData(raw: unknown): Record<string, unknown> {
  if (typeof raw === "string") return JSON.parse(raw);
  return raw as Record<string, unknown>;
}

interface ParticipantsPage {
  participants: TableData[];
  nextCursor?: number | null;
}

type InfiniteParticipantsData = InfiniteData<ParticipantsPage>;

interface UseSubmissionsTableRealtimeInput {
  domain: string;
  queryClient: QueryClient;
  participantsQueryPathKey: QueryKey;
}

interface TrackingState {
  processed: ReadonlyMap<string, ReadonlySet<number>>;
  finalized: ReadonlySet<string>;
}

function createEmptyTracking(): TrackingState {
  return { processed: new Map(), finalized: new Set() };
}

export type RealtimeEnrichedTableData = TableData & {
  realtimeProcessedCount: number;
  realtimeIsFinalized: boolean;
};

export function useSubmissionsTableRealtime({
  domain,
  queryClient,
  participantsQueryPathKey,
}: UseSubmissionsTableRealtimeInput) {
  const [tracking, setTracking] = useState<TrackingState>(createEmptyTracking);

  const scheduleInitializerInvalidate = useDebouncedInvalidate(
    queryClient,
    participantsQueryPathKey,
    INITIALIZER_INVALIDATE_DEBOUNCE_MS,
  );
  const scheduleTaskErrorInvalidate = useDebouncedInvalidate(
    queryClient,
    participantsQueryPathKey,
    TASK_ERROR_INVALIDATE_DEBOUNCE_MS,
  );
  const scheduleFinalizeSafetyInvalidate = useDebouncedInvalidate(
    queryClient,
    participantsQueryPathKey,
    FINALIZE_SAFETY_INVALIDATE_DEBOUNCE_MS,
  );

  const patchParticipantAsCompleted = useCallback(
    (reference: string) => {
      const normalizedRef = normalizeReference(reference);
      queryClient.setQueriesData<InfiniteParticipantsData>(
        { queryKey: participantsQueryPathKey },
        (currentData) => {
          if (!currentData) return currentData;
          let hasChanges = false;
          const nextPages = currentData.pages.map((page) => {
            let pageChanged = false;
            const nextParticipants = page.participants.map((p) => {
              if (normalizeReference(p.reference) !== normalizedRef) return p;
              if (p.status === "completed" || p.status === "verified") return p;
              pageChanged = true;
              hasChanges = true;
              return { ...p, status: "completed" as const };
            });
            return pageChanged
              ? { ...page, participants: nextParticipants }
              : page;
          });
          return hasChanges
            ? { ...currentData, pages: nextPages }
            : currentData;
        },
      );
    },
    [queryClient, participantsQueryPathKey],
  );

  const domainChannels = useMemo(
    () => [
      getDomainRealtimeChannel("dev", domain),
      getDomainRealtimeChannel("staging", domain),
      getDomainRealtimeChannel("prod", domain),
    ],
    [domain],
  );

  const handleInitialized = useCallback(
    (data: Record<string, unknown>) => {
      if (data.reference) {
        const ref = normalizeReference(data.reference as string);
        setTracking((prev) => {
          if (!prev.processed.has(ref) && !prev.finalized.has(ref)) {
            return prev;
          }
          const nextProcessed = new Map(prev.processed);
          nextProcessed.delete(ref);
          const nextFinalized = new Set(prev.finalized);
          nextFinalized.delete(ref);
          return { processed: nextProcessed, finalized: nextFinalized };
        });
      }
      scheduleInitializerInvalidate();
    },
    [scheduleInitializerInvalidate],
  );

  const handleSubmissionProcessed = useCallback(
    (data: Record<string, unknown>) => {
      if (data.outcome === "error") {
        scheduleTaskErrorInvalidate();
        return;
      }

      const reference = data.reference as string | null;
      const orderIndex = data.orderIndex as number | null | undefined;
      if (!reference) return;

      const ref = normalizeReference(reference);

      setTracking((prev) => {
        const prevIndices = prev.processed.get(ref);

        if (orderIndex !== null && orderIndex !== undefined) {
          if (prevIndices?.has(orderIndex)) return prev;

          const nextIndices = new Set(prevIndices);
          nextIndices.add(orderIndex);
          const nextProcessed = new Map(prev.processed);
          nextProcessed.set(ref, nextIndices);

          if (nextProcessed.size > MAX_TRACKED_REFERENCES) {
            const oldest = nextProcessed.keys().next().value;
            if (oldest !== undefined) nextProcessed.delete(oldest);
          }

          return { ...prev, processed: nextProcessed };
        }

        const syntheticIndex = prevIndices?.size ?? 0;
        const nextIndices = new Set(prevIndices);
        nextIndices.add(syntheticIndex);
        const nextProcessed = new Map(prev.processed);
        nextProcessed.set(ref, nextIndices);
        return { ...prev, processed: nextProcessed };
      });
    },
    [scheduleTaskErrorInvalidate],
  );

  const handleParticipantFinalized = useCallback(
    (data: Record<string, unknown>) => {
      if (data.outcome === "error") {
        scheduleTaskErrorInvalidate();
        return;
      }

      const reference = data.reference as string | null;
      if (!reference) return;

      const ref = normalizeReference(reference);

      setTracking((prev) => {
        if (prev.finalized.has(ref)) return prev;
        const nextFinalized = new Set(prev.finalized);
        nextFinalized.add(ref);
        return { ...prev, finalized: nextFinalized };
      });

      patchParticipantAsCompleted(reference);
      scheduleFinalizeSafetyInvalidate();
    },
    [
      scheduleTaskErrorInvalidate,
      patchParticipantAsCompleted,
      scheduleFinalizeSafetyInvalidate,
    ],
  );

  useRealtime({
    events: [...SUBSCRIBED_EVENTS],
    channels: domainChannels,
    enabled: domain.length > 0,
    onData: ({ event, data: rawData }) => {
      const data = parseRealtimeData(rawData);

      switch (event) {
        case RESULT_EVENT.uploadFlowInitializer:
          handleInitialized(data);
          break;
        case RESULT_EVENT.submissionProcessed:
          handleSubmissionProcessed(data);
          break;
        case RESULT_EVENT.participantFinalized:
          handleParticipantFinalized(data);
          break;
      }
    },
  });

  return tracking;
}

export function useEnrichedParticipants(
  participants: TableData[],
  tracking: TrackingState,
): RealtimeEnrichedTableData[] {
  return useMemo(
    () =>
      participants.map((p) => {
        const ref = normalizeReference(p.reference);
        return {
          ...p,
          realtimeProcessedCount: tracking.processed.get(ref)?.size ?? 0,
          realtimeIsFinalized: tracking.finalized.has(ref),
        };
      }),
    [participants, tracking],
  );
}
