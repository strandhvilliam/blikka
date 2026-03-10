"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  InfiniteData,
  QueryClient,
  QueryKey,
} from "@tanstack/react-query";
import { useDebouncedInvalidate } from "@/hooks/use-debounced-invalidate";
import {
  getDomainRealtimeChannel,
  getRealtimeChannelEnvironmentFromNodeEnv,
  getRealtimeResultEventName,
} from "@blikka/realtime/contract";
import { z } from "zod";

import { useRealtime } from "@/lib/realtime-client";
import type { TableData } from "./use-submissions-table";

type ParsedRealtimeEventData = z.infer<typeof realtimeEventDataSchema>;

interface ParticipantsPage {
  participants: TableData[];
  nextCursor?: number | null;
}

type InfiniteParticipantsData = InfiniteData<ParticipantsPage>;
type RealtimeEventName = (typeof SUBSCRIBED_EVENTS)[number];

interface QueuedRealtimeEvent {
  event: RealtimeEventName;
  data: ParsedRealtimeEventData;
}

interface UseSubmissionsTableRealtimeInput {
  domain: string;
  queryClient: QueryClient;
  participantsQueryPathKey: QueryKey;
}

interface TrackingState {
  processed: ReadonlyMap<string, ReadonlySet<number>>;
  finalized: ReadonlySet<string>;
}

interface BatchedRealtimeEffects {
  invalidateInitializer: boolean;
  invalidateTaskError: boolean;
  invalidateFinalizeSafety: boolean;
  finalizedReferences: Set<string>;
}

const realtimeEventDataSchema = z
  .object({
    reference: z.string().nullish(),
    orderIndex: z.number().nullish(),
    outcome: z.enum(["success", "error"]).optional(),
  })
  .loose();

const REALTIME_CHANNEL_ENV = getRealtimeChannelEnvironmentFromNodeEnv(
  typeof process !== "undefined" ? process.env.NODE_ENV : undefined,
);

const RESULT_EVENT = {
  uploadFlowInitializer: getRealtimeResultEventName("upload-flow-initialized"),
  participantPrepared: getRealtimeResultEventName("participant-prepared"),
  submissionProcessed: getRealtimeResultEventName("submission-processed"),
  participantFinalized: getRealtimeResultEventName("participant-finalized"),
} as const;

const SUBSCRIBED_EVENTS = [
  RESULT_EVENT.uploadFlowInitializer,
  RESULT_EVENT.participantPrepared,
  RESULT_EVENT.submissionProcessed,
  RESULT_EVENT.participantFinalized,
] as const;

const INITIALIZER_INVALIDATE_DEBOUNCE_MS = 750;
const TASK_ERROR_INVALIDATE_DEBOUNCE_MS = 750;
const FINALIZE_SAFETY_INVALIDATE_DEBOUNCE_MS = 10_000;
const MAX_TRACKED_REFERENCES = 1000;
const REALTIME_BATCH_WINDOW_MS = 80;
const MAX_PENDING_REALTIME_EVENTS = 200;

/**
 * Normalizes realtime payloads into the validated shape this hook expects.
 * The transport may deliver either parsed objects or JSON strings.
 */
function parseRealtimeEventData(raw: unknown): ParsedRealtimeEventData {
  const asRecord =
    typeof raw === "string"
      ? (() => {
          try {
            return JSON.parse(raw) as unknown;
          } catch {
            return {};
          }
        })()
      : raw;
  const parsed = realtimeEventDataSchema.safeParse(asRecord);
  return parsed.success ? parsed.data : {};
}

/**
 * Collapses a burst of realtime events into the smallest set of invalidations
 * and optimistic cache updates needed to keep the table in sync.
 */
function collectBatchedEffects(
  queuedEvents: QueuedRealtimeEvent[],
): BatchedRealtimeEffects {
  const effects: BatchedRealtimeEffects = {
    invalidateInitializer: false,
    invalidateTaskError: false,
    invalidateFinalizeSafety: false,
    finalizedReferences: new Set(),
  };

  for (const queuedEvent of queuedEvents) {
    const { event, data } = queuedEvent;

    switch (event) {
      case RESULT_EVENT.uploadFlowInitializer:
      case RESULT_EVENT.participantPrepared: {
        effects.invalidateInitializer = true;
        break;
      }
      case RESULT_EVENT.submissionProcessed: {
        if (data.outcome === "error") {
          effects.invalidateTaskError = true;
        }
        break;
      }
      case RESULT_EVENT.participantFinalized: {
        if (data.outcome === "error") {
          effects.invalidateTaskError = true;
          break;
        }

        if (data.reference) {
          effects.invalidateFinalizeSafety = true;
          effects.finalizedReferences.add(data.reference);
        }
        break;
      }
    }
  }

  return effects;
}

/**
 * Applies queued realtime events to the local tracking state while preserving
 * structural sharing when the batch results in no actual changes.
 */
function reduceTrackingState(
  previous: TrackingState,
  queuedEvents: QueuedRealtimeEvent[],
): TrackingState {
  let nextProcessed:
    | ReadonlyMap<string, ReadonlySet<number>>
    | Map<string, ReadonlySet<number>> = previous.processed;
  let nextFinalized: ReadonlySet<string> | Set<string> = previous.finalized;

  const ensureProcessedMutable = (): Map<string, ReadonlySet<number>> => {
    if (nextProcessed === previous.processed) {
      nextProcessed = new Map(previous.processed);
    }
    return nextProcessed as Map<string, ReadonlySet<number>>;
  };

  const ensureFinalizedMutable = (): Set<string> => {
    if (nextFinalized === previous.finalized) {
      nextFinalized = new Set(previous.finalized);
    }
    return nextFinalized as Set<string>;
  };

  for (const queuedEvent of queuedEvents) {
    const { event, data } = queuedEvent;

    switch (event) {
      case RESULT_EVENT.uploadFlowInitializer:
      case RESULT_EVENT.participantPrepared: {
        if (!data.reference) {
          break;
        }

        const reference = data.reference;
        if (!nextProcessed.has(reference) && !nextFinalized.has(reference)) {
          break;
        }

        if (nextProcessed.has(reference)) {
          const processed = ensureProcessedMutable();
          processed.delete(reference);
        }

        if (nextFinalized.has(reference)) {
          const finalized = ensureFinalizedMutable();
          finalized.delete(reference);
        }
        break;
      }
      case RESULT_EVENT.submissionProcessed: {
        if (data.outcome === "error") break;
        if (!data.reference) break;

        const processed = ensureProcessedMutable();
        const previousIndices = processed.get(data.reference);
        const orderIndex = data.orderIndex;

        if (orderIndex !== undefined && orderIndex !== null) {
          if (previousIndices?.has(orderIndex)) break;

          const nextIndices = new Set(previousIndices);
          nextIndices.add(orderIndex);
          processed.set(data.reference, nextIndices);
        } else {
          const syntheticIndex = previousIndices?.size ?? 0;
          const nextIndices = new Set(previousIndices);
          nextIndices.add(syntheticIndex);
          processed.set(data.reference, nextIndices);
        }

        if (processed.size > MAX_TRACKED_REFERENCES) {
          const oldestReference = processed.keys().next().value;
          if (oldestReference !== undefined) {
            processed.delete(oldestReference);
          }
        }
        break;
      }
      case RESULT_EVENT.participantFinalized: {
        if (data.outcome === "error") break;
        if (!data.reference) break;
        if (nextFinalized.has(data.reference)) break;

        const finalized = ensureFinalizedMutable();
        finalized.add(data.reference);
        break;
      }
    }
  }

  if (
    nextProcessed === previous.processed &&
    nextFinalized === previous.finalized
  ) {
    return previous;
  }

  return {
    processed: nextProcessed,
    finalized: nextFinalized,
  };
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
  const [tracking, setTracking] = useState<TrackingState>(() => ({
    processed: new Map(),
    finalized: new Set(),
  }));
  const pendingEventsRef = useRef<QueuedRealtimeEvent[]>([]);
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  /**
   * Marks a participant as completed in the cached pages as soon as a finalize
   * event arrives. A delayed invalidate still runs afterwards to reconcile any
   * fields that are not patched locally.
   */
  const patchParticipantAsCompleted = useCallback(
    (reference: string) => {
      queryClient.setQueriesData<InfiniteParticipantsData>(
        { queryKey: participantsQueryPathKey },
        (currentData) => {
          if (!currentData) return currentData;
          if (!Array.isArray(currentData.pages)) return currentData;

          let hasChanges = false;
          const nextPages = currentData.pages.map((page) => {
            if (!Array.isArray(page?.participants)) {
              return page;
            }

            let pageChanged = false;
            const nextParticipants = page.participants.map((participant) => {
              if (participant.reference !== reference) {
                return participant;
              }

              if (
                participant.status === "completed" ||
                participant.status === "verified"
              ) {
                return participant;
              }

              pageChanged = true;
              hasChanges = true;
              return { ...participant, status: "completed" as const };
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

  /**
   * Flushes the queued realtime window so side effects, optimistic cache
   * updates, and local tracking state are all derived from the same event batch.
   */
  const flushQueuedEvents = useCallback(() => {
    flushTimeoutRef.current = null;

    const queuedEvents = pendingEventsRef.current;
    if (queuedEvents.length === 0) {
      return;
    }

    pendingEventsRef.current = [];

    const effects = collectBatchedEffects(queuedEvents);

    if (effects.invalidateInitializer) {
      scheduleInitializerInvalidate();
    }

    if (effects.invalidateTaskError) {
      scheduleTaskErrorInvalidate();
    }

    if (effects.invalidateFinalizeSafety) {
      scheduleFinalizeSafetyInvalidate();
    }

    for (const reference of effects.finalizedReferences) {
      patchParticipantAsCompleted(reference);
    }

    startTransition(() => {
      setTracking((previous) => reduceTrackingState(previous, queuedEvents));
    });
  }, [
    patchParticipantAsCompleted,
    scheduleFinalizeSafetyInvalidate,
    scheduleInitializerInvalidate,
    scheduleTaskErrorInvalidate,
  ]);

  /**
   * Starts a single timer for the current realtime burst so nearby events are
   * processed together instead of triggering per-event work.
   */
  const scheduleFlush = useCallback(() => {
    if (flushTimeoutRef.current !== null) {
      return;
    }

    flushTimeoutRef.current = setTimeout(
      flushQueuedEvents,
      REALTIME_BATCH_WINDOW_MS,
    );
  }, [flushQueuedEvents]);

  useEffect(() => {
    return () => {
      if (flushTimeoutRef.current !== null) {
        clearTimeout(flushTimeoutRef.current);
      }

      flushTimeoutRef.current = null;
      pendingEventsRef.current = [];
    };
  }, []);

  const domainChannel = useMemo(
    () => getDomainRealtimeChannel(REALTIME_CHANNEL_ENV, domain),
    [domain],
  );

  useRealtime({
    events: [...SUBSCRIBED_EVENTS],
    channels: [domainChannel],
    enabled: domain.length > 0,
    onData: ({ event, data: rawData }) => {
      const data = parseRealtimeEventData(rawData);
      pendingEventsRef.current.push({ event, data });

      if (pendingEventsRef.current.length >= MAX_PENDING_REALTIME_EVENTS) {
        if (flushTimeoutRef.current !== null) {
          clearTimeout(flushTimeoutRef.current);
          flushTimeoutRef.current = null;
        }
        flushQueuedEvents();
        return;
      }

      scheduleFlush();
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
      participants.map((participant) => {
        const reference = participant.reference;

        return {
          ...participant,
          realtimeProcessedCount: tracking.processed.get(reference)?.size ?? 0,
          realtimeIsFinalized: tracking.finalized.has(reference),
        };
      }),
    [participants, tracking],
  );
}
