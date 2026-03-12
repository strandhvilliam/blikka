"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import { PARTICIPANT_UPLOAD_PHASE } from "@/lib/participant-upload/types";
import { useStaffUploadStore } from "../_lib/staff-upload-store";
import type { StaffUploadStep } from "./use-staff-upload-step";

type UploadStatusData = {
  submissions: { key: string; uploaded: boolean }[];
  participant?: {
    errors: readonly string[];
    finalized: boolean;
  } | null;
};

type SetStepFn = (step: StaffUploadStep) => unknown;

/**
 * Syncs the upload status poll data into the store and handles completion.
 * Also navigates to the "complete" step once finalized.
 *
 * Returns `resetCompletion` which must be called before each new upload run
 * to prevent the completion toast from being suppressed.
 */
export function useUploadStatusSync(
  uploadStatusData: UploadStatusData | undefined,
  setStep: SetStepFn,
) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const completionHandledRef = useRef(false);

  const uploadFiles = useStaffUploadStore((s) => s.uploadFiles);
  const patchUpload = useStaffUploadStore((s) => s.patchUpload);

  useEffect(() => {
    if (!uploadStatusData || uploadFiles.length === 0) return;

    let didUpdateFiles = false;
    const updatedFiles = uploadFiles.map((file) => {
      const status = uploadStatusData.submissions.find(
        (submission) => submission.key === file.key,
      );

      if (
        status?.uploaded &&
        file.phase !== PARTICIPANT_UPLOAD_PHASE.COMPLETED
      ) {
        didUpdateFiles = true;
        return {
          ...file,
          phase: PARTICIPANT_UPLOAD_PHASE.COMPLETED,
          progress: 100,
          error: undefined,
        };
      }

      return file;
    });

    if (didUpdateFiles) {
      patchUpload({ uploadFiles: updatedFiles });
    }

    if (uploadStatusData.participant?.errors.length) {
      patchUpload({
        uploadErrorMessage: uploadStatusData.participant.errors.join(", "),
      });
    }

    if (!uploadStatusData.participant?.finalized) return;

    if (completionHandledRef.current) return;

    completionHandledRef.current = true;
    patchUpload({
      isPollingStatus: false,
      isUploadingFiles: false,
      uploadComplete: true,
      uploadErrorMessage: null,
    });
    void setStep("complete");
    toast.success("Participant created and upload completed");
    queryClient.invalidateQueries({
      queryKey: trpc.participants.getByDomainInfinite.pathKey(),
    });
  }, [
    queryClient,
    patchUpload,
    setStep,
    trpc.participants,
    uploadFiles,
    uploadStatusData,
  ]);

  const resetCompletion = () => {
    completionHandledRef.current = false;
  };

  return { resetCompletion };
}
