"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  getParticipantRealtimeChannel,
  getRealtimeChannelEnvironmentFromNodeEnv,
  getRealtimeResultEventName,
} from "@blikka/realtime/contract";
import { useRealtime } from "@/lib/realtime-client";
import {
  parseUploadRealtimeEventData,
  type UploadRealtimeEventData,
} from "../_lib/upload-status-realtime";

const REALTIME_CHANNEL_ENV = getRealtimeChannelEnvironmentFromNodeEnv(
  typeof process !== "undefined" ? process.env.NODE_ENV : undefined,
);

const SUBMISSION_PROCESSED_EVENT = getRealtimeResultEventName(
  "submission-processed",
);
const PARTICIPANT_FINALIZED_EVENT = getRealtimeResultEventName(
  "participant-finalized",
);

const SUBSCRIBED_EVENTS = [
  SUBMISSION_PROCESSED_EVENT,
  PARTICIPANT_FINALIZED_EVENT,
] as const;

type UploadRealtimeEventName = (typeof SUBSCRIBED_EVENTS)[number];

interface UseUploadStatusRealtimeOptions {
  domain: string;
  reference: string;
  enabled: boolean;
  onSubmissionProcessed: (data: UploadRealtimeEventData) => void;
  onParticipantFinalized: (data: UploadRealtimeEventData) => void;
  onEventError: (
    event: UploadRealtimeEventName,
    data: UploadRealtimeEventData,
  ) => void;
}

export function useUploadStatusRealtime({
  domain,
  reference,
  enabled,
  onSubmissionProcessed,
  onParticipantFinalized,
  onEventError,
}: UseUploadStatusRealtimeOptions) {
  const handlersRef = useRef({
    onSubmissionProcessed,
    onParticipantFinalized,
    onEventError,
  });

  useEffect(() => {
    handlersRef.current = {
      onSubmissionProcessed,
      onParticipantFinalized,
      onEventError,
    };
  }, [onSubmissionProcessed, onParticipantFinalized, onEventError]);

  const participantChannel = useMemo(() => {
    if (!domain || !reference) {
      return "";
    }

    return getParticipantRealtimeChannel(
      REALTIME_CHANNEL_ENV,
      domain,
      reference,
    );
  }, [domain, reference]);

  useRealtime({
    events: [...SUBSCRIBED_EVENTS],
    channels: participantChannel ? [participantChannel] : [],
    enabled: enabled && participantChannel.length > 0,
    onData: ({ event, data: rawData }) => {
      const data = parseUploadRealtimeEventData(rawData);
      if (!data?.reference || data.reference !== reference) {
        return;
      }

      if (data.outcome === "error") {
        handlersRef.current.onEventError(event, data);
        return;
      }

      if (data.outcome !== "success") {
        return;
      }

      if (event === SUBMISSION_PROCESSED_EVENT) {
        handlersRef.current.onSubmissionProcessed(data);
        return;
      }

      if (event === PARTICIPANT_FINALIZED_EVENT) {
        handlersRef.current.onParticipantFinalized(data);
      }
    },
  });
}
