"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import type { QueryClient } from "@tanstack/react-query";
import {
  PARTICIPANT_UPLOAD_PHASE,
  type ParticipantPreparedUpload,
  type ParticipantSelectedPhoto,
  type ParticipantUploadFileState,
} from "@/lib/participant-upload/types";
import { uploadPreparedFiles } from "@/lib/participant-upload/upload-runner";
import { pluralizePhotos, type FormState } from "@/hooks/use-participant-upload-form";
import { useTRPC } from "@/lib/trpc/client";

const POLLING_INTERVAL_MS = 3000;

interface UseParticipantUploadFlowInput {
  domain: string;
  marathonMode: string;
  formValues: FormState;
  queryClient: QueryClient;
}

type ParticipantUploadDraft = Partial<FormState>;

export function useParticipantUploadFlow({
  domain,
  marathonMode,
  formValues,
  queryClient,
}: UseParticipantUploadFlowInput) {
  const trpc = useTRPC();
  const completionHandledRef = useRef(false);

  const [uploadFiles, setUploadFiles] = useState<ParticipantUploadFileState[]>(
    [],
  );
  const [submittedReference, setSubmittedReference] = useState("");
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [isPollingStatus, setIsPollingStatus] = useState(false);
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(
    null,
  );
  const [uploadComplete, setUploadComplete] = useState(false);

  const initializeUploadFlowMutation = useMutation(
    trpc.uploadFlow.initializeUploadFlow.mutationOptions(),
  );
  const initializeByCameraUploadMutation = useMutation(
    trpc.uploadFlow.initializeByCameraUpload.mutationOptions(),
  );

  const uploadFileKeys = uploadFiles.map((file) => file.key).join(",");

  const uploadStatusQuery = useQuery(
    trpc.uploadFlow.getUploadStatus.queryOptions(
      {
        domain,
        reference: submittedReference,
        orderIndexes: uploadFiles.map((file) => file.orderIndex),
      },
      {
        enabled:
          isPollingStatus &&
          submittedReference.length > 0 &&
          uploadFiles.length > 0,
        refetchInterval: POLLING_INTERVAL_MS,
        refetchIntervalInBackground: false,
      },
    ),
  );

  function updateUploadFileState(
    key: string,
    patch: Partial<
      Pick<ParticipantUploadFileState, "phase" | "progress" | "error">
    >,
  ) {
    setUploadFiles((current) =>
      current.map((file) =>
        file.key === key
          ? {
              ...file,
              ...patch,
            }
          : file,
      ),
    );
  }

  useEffect(() => {
    const uploadStatus = uploadStatusQuery.data;
    if (!uploadStatus || !uploadFileKeys) {
      return;
    }

    setUploadFiles((current) =>
      current.map((file) => {
        const status = uploadStatus.submissions.find(
          (submission) => submission.key === file.key,
        );

        if (status?.uploaded && file.phase !== PARTICIPANT_UPLOAD_PHASE.COMPLETED) {
          return {
            ...file,
            phase: PARTICIPANT_UPLOAD_PHASE.COMPLETED,
            progress: 100,
            error: undefined,
          };
        }

        return file;
      }),
    );

    if (uploadStatus.participant?.errors.length) {
      setUploadErrorMessage(uploadStatus.participant.errors.join(", "));
    }

    if (uploadStatus.participant?.finalized) {
      setIsPollingStatus(false);
      setIsUploadingFiles(false);
      setUploadComplete(true);
      setUploadErrorMessage(null);

      if (!completionHandledRef.current) {
        completionHandledRef.current = true;
        toast.success("Participant created and upload completed");
        queryClient.invalidateQueries({
          queryKey: trpc.participants.getByDomainInfinite.pathKey(),
        });
      }
    }
  }, [queryClient, trpc.participants, uploadFileKeys, uploadStatusQuery.data]);

  async function runUpload(
    reference: string,
    selectedPhotos: ParticipantSelectedPhoto[],
    participantDraft?: ParticipantUploadDraft,
  ) {
    if (selectedPhotos.length === 0) {
      return;
    }

    const resolvedFormValues = {
      ...formValues,
      ...participantDraft,
      reference,
    };

    setUploadErrorMessage(null);
    setUploadComplete(false);
    setIsUploadingFiles(true);
    setIsPollingStatus(false);
    completionHandledRef.current = false;

    try {
      const commonPayload = {
        domain,
        firstname: resolvedFormValues.firstName.trim(),
        lastname: resolvedFormValues.lastName.trim(),
        email: resolvedFormValues.email.trim(),
        deviceGroupId: Number(resolvedFormValues.deviceGroupId),
        phoneNumber: resolvedFormValues.phone.trim(),
      };

      const initialization =
        marathonMode === "marathon"
          ? await initializeUploadFlowMutation.mutateAsync({
              ...commonPayload,
              reference,
              phoneNumber: resolvedFormValues.phone.trim()
                ? resolvedFormValues.phone.trim()
                : null,
              competitionClassId: Number(resolvedFormValues.competitionClassId),
            })
          : await initializeByCameraUploadMutation.mutateAsync(commonPayload);

      const resolvedReference =
        marathonMode === "marathon" || Array.isArray(initialization)
          ? reference
          : initialization.reference;
      const presignedUrls = Array.isArray(initialization)
        ? initialization
        : initialization.uploads;

      if (!presignedUrls.length) {
        throw new Error("Failed to initialize upload URLs");
      }

      const preparedUploads: ParticipantPreparedUpload[] = selectedPhotos.map(
        (photo, index) => {
          const urlData = presignedUrls[index];
          if (!urlData) {
            throw new Error(`Missing upload URL for image #${index + 1}`);
          }

          return {
            ...photo,
            key: urlData.key,
            presignedUrl: urlData.url,
          };
        },
      );

      const initialUploadState: ParticipantUploadFileState[] =
        preparedUploads.map((photo) => ({
          ...photo,
          phase: PARTICIPANT_UPLOAD_PHASE.PRESIGNED,
          progress: 0,
          error: undefined,
        }));

      setUploadFiles(initialUploadState);
      setSubmittedReference(resolvedReference);

      const { successKeys, failedKeys } = await uploadPreparedFiles({
        files: preparedUploads,
        onFileStateChange: updateUploadFileState,
      });

      if (successKeys.length > 0) {
        setIsPollingStatus(true);
      }

      if (failedKeys.length > 0) {
        const message = `${failedKeys.length} ${pluralizePhotos(failedKeys.length)} failed to upload`;
        setUploadErrorMessage(message);
        toast.error(message);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to initialize upload";
      setUploadErrorMessage(message);
      toast.error(message);
    } finally {
      setIsUploadingFiles(false);
    }
  }

  async function handleRetryFailed() {
    const failedUploads = uploadFiles.filter(
      (file) => file.phase === PARTICIPANT_UPLOAD_PHASE.ERROR,
    );

    if (failedUploads.length === 0) {
      return;
    }

    setUploadErrorMessage(null);
    setIsUploadingFiles(true);

    try {
      const { successKeys, failedKeys } = await uploadPreparedFiles({
        files: failedUploads,
        onFileStateChange: updateUploadFileState,
      });

      if (successKeys.length > 0) {
        setIsPollingStatus(true);
      }

      if (failedKeys.length > 0) {
        const message = `${failedKeys.length} ${pluralizePhotos(failedKeys.length)} still failing`;
        setUploadErrorMessage(message);
        toast.error(message);
      }
    } finally {
      setIsUploadingFiles(false);
    }
  }

  const canRetryFailedUploads = uploadFiles.some(
    (file) => file.phase === PARTICIPANT_UPLOAD_PHASE.ERROR,
  );

  const uploadProgress = useMemo(() => {
    if (uploadFiles.length === 0) {
      return { completed: 0, total: 0 };
    }
    return {
      completed: uploadFiles.filter(
        (file) => file.phase === PARTICIPANT_UPLOAD_PHASE.COMPLETED,
      ).length,
      total: uploadFiles.length,
    };
  }, [uploadFiles]);

  function resetUploadFlow() {
    setUploadFiles([]);
    setSubmittedReference("");
    setIsUploadingFiles(false);
    setIsPollingStatus(false);
    setUploadErrorMessage(null);
    setUploadComplete(false);
    completionHandledRef.current = false;
  }

  return {
    uploadFiles,
    setUploadFiles,
    submittedReference,
    isUploadingFiles,
    isPollingStatus,
    uploadErrorMessage,
    uploadComplete,
    updateUploadFileState,
    runUpload,
    handleRetryFailed,
    canRetryFailedUploads,
    uploadProgress,
    resetUploadFlow,
    initializeUploadFlowMutation,
    initializeByCameraUploadMutation,
  };
}

