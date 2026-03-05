"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import type { QueryClient } from "@tanstack/react-query";
import {
  ADMIN_UPLOAD_PHASE,
  type AdminPreparedUpload,
  type AdminSelectedPhoto,
  type AdminUploadFileState,
} from "../_lib/types";
import { uploadPreparedFiles } from "../_lib/upload-runner";
import { pluralizePhotos } from "./use-participant-upload-form";
import { useTRPC } from "@/lib/trpc/client";

const POLLING_INTERVAL_MS = 3000;


interface UseUploadFlowInput {
  domain: string;
  marathonMode: string;
  formValues: FormValues;
  queryClient: QueryClient;
}

export function useUploadFlow({
  domain,
  marathonMode,
  formValues,
  queryClient,
}: UseUploadFlowInput) {
  const trpc = useTRPC();
  const completionHandledRef = useRef(false);

  const [uploadFiles, setUploadFiles] = useState<AdminUploadFileState[]>([]);
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

  const uploadFileKeys = uploadFiles.map((f) => f.key).join(",");

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
      Pick<AdminUploadFileState, "phase" | "progress" | "error">
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

    setUploadFiles((current) => {
      const next = current.map((file) => {
        const status = uploadStatus.submissions.find(
          (submission) => submission.key === file.key,
        );

        if (status?.uploaded && file.phase !== ADMIN_UPLOAD_PHASE.COMPLETED) {
          return {
            ...file,
            phase: ADMIN_UPLOAD_PHASE.COMPLETED,
            progress: 100,
            error: undefined,
          };
        }

        return file;
      });

      return next;
    });

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
  }, [
    queryClient,
    trpc.participants,
    uploadFileKeys,
    uploadStatusQuery.data,
  ]);

  async function runUpload(
    reference: string,
    selectedPhotos: AdminSelectedPhoto[],
  ) {
    if (selectedPhotos.length === 0) {
      return;
    }

    setUploadErrorMessage(null);
    setUploadComplete(false);
    setIsUploadingFiles(true);
    setIsPollingStatus(false);
    completionHandledRef.current = false;

    try {
      const commonPayload = {
        domain,
        reference,
        firstname: formValues.firstName.trim(),
        lastname: formValues.lastName.trim(),
        email: formValues.email.trim(),
        deviceGroupId: Number(formValues.deviceGroupId),
        phoneNumber: formValues.phone.trim()
          ? formValues.phone.trim()
          : null,
      };

      const presignedUrls =
        marathonMode === "marathon"
          ? await initializeUploadFlowMutation.mutateAsync({
            ...commonPayload,
            competitionClassId: Number(formValues.competitionClassId),
          })
          : await initializeByCameraUploadMutation.mutateAsync(commonPayload);

      if (!presignedUrls.length) {
        throw new Error("Failed to initialize upload URLs");
      }

      const preparedUploads: AdminPreparedUpload[] = selectedPhotos.map(
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

      const initialUploadState: AdminUploadFileState[] = preparedUploads.map(
        (photo) => ({
          ...photo,
          phase: ADMIN_UPLOAD_PHASE.PRESIGNED,
          progress: 0,
          error: undefined,
        }),
      );

      setUploadFiles(initialUploadState);
      setSubmittedReference(reference);

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
        error instanceof Error
          ? error.message
          : "Failed to initialize upload";
      setUploadErrorMessage(message);
      toast.error(message);
    } finally {
      setIsUploadingFiles(false);
    }
  }

  async function handleRetryFailed() {
    const failedUploads = uploadFiles.filter(
      (file) => file.phase === ADMIN_UPLOAD_PHASE.ERROR,
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
    (file) => file.phase === ADMIN_UPLOAD_PHASE.ERROR,
  );

  const uploadProgress = useMemo(() => {
    if (uploadFiles.length === 0) {
      return { completed: 0, total: 0 };
    }
    return {
      completed: uploadFiles.filter(
        (file) => file.phase === ADMIN_UPLOAD_PHASE.COMPLETED,
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
