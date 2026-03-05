"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useDropzone, type Accept } from "react-dropzone";
import type {
  CompetitionClass,
  DeviceGroup,
  RuleConfig,
  Topic,
} from "@blikka/db";
import { CheckCircle2, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PrimaryButton } from "@/components/ui/primary-button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { formatDomainPathname } from "@/lib/utils";
import { useTRPC } from "@/lib/trpc/client";
import { revokePhotoPreviewUrls } from "../_lib/admin-upload/file-processing";
import { pluralizePhotos, useParticipantUploadForm } from "../_hooks/use-participant-upload-form";
import { usePhotoSelection } from "../_hooks/use-photo-selection";
import { useUploadFlow } from "../_hooks/use-upload-flow";
import { ParticipantDetailsForm } from "./admin-upload-dialog/participant-details-form";
import { UploadMappingSection } from "./admin-upload-dialog/upload-mapping-section";
import { ImageDropzoneSection } from "./admin-upload-dialog/image-dropzone-section";
import { SelectedImagesSection } from "./admin-upload-dialog/selected-images-section";
import { UploadStatusSection } from "./admin-upload-dialog/upload-status-section";

const DROPZONE_ACCEPT: Accept = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/gif": [".gif"],
  "image/webp": [".webp"],
  "image/heic": [".heic"],
  "image/heif": [".heif"],
};

type MarathonMode = "marathon" | "by-camera";

interface AdminParticipantUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain: string;
  marathonMode: MarathonMode;
  competitionClasses: CompetitionClass[];
  deviceGroups: DeviceGroup[];
  topics: Topic[];
  ruleConfigs: RuleConfig[];
  marathonStartDate?: string | null;
  marathonEndDate?: string | null;
}

export function AdminParticipantUploadDialog({
  open,
  onOpenChange,
  domain,
  marathonMode,
  competitionClasses,
  deviceGroups,
  topics,
  ruleConfigs,
  marathonStartDate,
  marathonEndDate,
}: AdminParticipantUploadDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const signatureRef = useRef<string | null>(null);

  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false);
  const [pendingReference, setPendingReference] = useState<string | null>(null);
  const [filesError, setFilesError] = useState<string | null>(null);
  const submitLogicRef = useRef<
    (value: { reference: string } & Record<string, string>) => Promise<void>
  >(null);

  const checkParticipantExistsMutation = useMutation(
    trpc.uploadFlow.checkParticipantExists.mutationOptions(),
  );

  const {
    form,
    formValues,
    validateFiles,
    resetForm,
  } = useParticipantUploadForm(marathonMode, {
    onSubmit: async (value) => {
      await submitLogicRef.current?.(value);
    },
  });

  const sortedTopics = useMemo(
    () => topics.toSorted((a, b) => a.orderIndex - b.orderIndex),
    [topics],
  );

  const activeByCameraTopic = useMemo(
    () => sortedTopics.find((topic) => topic.visibility === "active") ?? null,
    [sortedTopics],
  );

  const selectedCompetitionClass = useMemo(
    () =>
      competitionClasses.find(
        (competitionClass) =>
          competitionClass.id === Number(formValues.competitionClassId),
      ) ?? null,
    [competitionClasses, formValues.competitionClassId],
  );

  const selectedTopics = useMemo(() => {
    if (marathonMode === "by-camera") {
      return activeByCameraTopic ? [activeByCameraTopic] : [];
    }

    if (!selectedCompetitionClass) {
      return [];
    }

    return sortedTopics.slice(
      selectedCompetitionClass.topicStartIndex,
      selectedCompetitionClass.topicStartIndex +
        selectedCompetitionClass.numberOfPhotos,
    );
  }, [
    activeByCameraTopic,
    marathonMode,
    selectedCompetitionClass,
    sortedTopics,
  ]);

  const expectedPhotoCount = useMemo(() => {
    if (marathonMode === "by-camera") {
      return activeByCameraTopic ? 1 : 0;
    }

    return selectedCompetitionClass?.numberOfPhotos ?? 0;
  }, [activeByCameraTopic, marathonMode, selectedCompetitionClass]);

  const topicOrderIndexes = useMemo(
    () => selectedTopics.map((topic) => topic.orderIndex),
    [selectedTopics],
  );

  const isMappingReady =
    !!formValues.deviceGroupId &&
    (marathonMode === "marathon" ? !!formValues.competitionClassId : !!activeByCameraTopic);

  const dropzoneDisabledReason = useMemo(() => {
    if (!formValues.deviceGroupId) {
      return "Select a device group to enable image selection.";
    }

    if (marathonMode === "marathon" && !formValues.competitionClassId) {
      return "Select a competition class to enable image selection.";
    }

    if (marathonMode === "by-camera" && !activeByCameraTopic) {
      return "No active topic is available for by-camera upload.";
    }

    return null;
  }, [
    activeByCameraTopic,
    formValues.competitionClassId,
    formValues.deviceGroupId,
    marathonMode,
  ]);

  const canSelectFiles = isMappingReady && expectedPhotoCount > 0;

  const uploadFlow = useUploadFlow({
    domain,
    marathonMode,
    formValues,
    trpc,
    queryClient,
  });

  const isUploadBusy =
    uploadFlow.isUploadingFiles ||
    uploadFlow.isPollingStatus ||
    uploadFlow.initializeUploadFlowMutation.isPending ||
    uploadFlow.initializeByCameraUploadMutation.isPending;

  const handleResetUploadState = useCallback(() => {
    uploadFlow.resetUploadFlow();
  }, [uploadFlow]);

  const photoSelection = usePhotoSelection({
    open,
    topicOrderIndexes,
    expectedPhotoCount,
    ruleConfigs,
    marathonStartDate,
    marathonEndDate,
    isUploadBusy,
    uploadComplete: uploadFlow.uploadComplete,
    canSelectFiles,
    onClearFormFilesError: () => setFilesError(null),
    onResetUploadState: handleResetUploadState,
  });

  const { selectedPhotos } = photoSelection;

  const isBusy =
    photoSelection.isProcessingFiles ||
    uploadFlow.isUploadingFiles ||
    uploadFlow.isPollingStatus ||
    checkParticipantExistsMutation.isPending ||
    uploadFlow.initializeUploadFlowMutation.isPending ||
    uploadFlow.initializeByCameraUploadMutation.isPending;

  const isPrimaryActionBusy =
    photoSelection.isProcessingFiles ||
    uploadFlow.isUploadingFiles ||
    checkParticipantExistsMutation.isPending ||
    uploadFlow.initializeUploadFlowMutation.isPending ||
    uploadFlow.initializeByCameraUploadMutation.isPending;

  const isMaxImagesReached =
    selectedPhotos.length >= expectedPhotoCount && expectedPhotoCount > 0;
  const isDropzoneDisabled =
    !canSelectFiles || isBusy || uploadFlow.uploadComplete || isMaxImagesReached;

  const dropzoneVariant = useMemo(() => {
    if (!canSelectFiles) return "disabled" as const;
    if (isMaxImagesReached) return "complete" as const;
    if (uploadFlow.uploadComplete) return "success" as const;
    if (isBusy) return "processing" as const;
    return "ready" as const;
  }, [canSelectFiles, isMaxImagesReached, uploadFlow.uploadComplete, isBusy]);

  useEffect(() => {
    submitLogicRef.current = async (formValue) => {
      setFilesError(null);
      const filesValidationError = validateFiles({
        expectedPhotoCount,
        selectedPhotosCount: selectedPhotos.length,
        validationResults: photoSelection.validationResults,
        validationRunError: photoSelection.validationRunError,
      });
      if (filesValidationError) {
        setFilesError(filesValidationError);
        return;
      }
      try {
        const exists = await checkParticipantExistsMutation.mutateAsync({
          domain,
          reference: formValue.reference,
        });
        if (exists) {
          setPendingReference(formValue.reference);
          setShowOverwriteDialog(true);
          return;
        }
        await uploadFlow.runUpload(formValue.reference, selectedPhotos);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to check participant reference";
        toast.error(message);
      }
    };
  }, [
    domain,
    expectedPhotoCount,
    selectedPhotos,
    photoSelection.validationResults,
    photoSelection.validationRunError,
    checkParticipantExistsMutation,
    uploadFlow,
    validateFiles,
  ]);

  const resetDialogState = useCallback(() => {
    resetForm();
    setFilesError(null);
    photoSelection.resetPhotoSelection();
    uploadFlow.resetUploadFlow();
    setPendingReference(null);
    setShowOverwriteDialog(false);
    signatureRef.current = null;
  }, [resetForm, photoSelection, uploadFlow]);

  const handleDialogOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        resetDialogState();
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, resetDialogState],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const signature = `${expectedPhotoCount}:${topicOrderIndexes.join(",")}`;

    if (!signatureRef.current) {
      signatureRef.current = signature;
      return;
    }

    if (signatureRef.current !== signature && selectedPhotos.length > 0) {
      revokePhotoPreviewUrls(selectedPhotos);
      photoSelection.setSelectedPhotos([]);
      uploadFlow.resetUploadFlow();
      toast.message(
        "Image selection cleared because class/topic mapping changed",
      );
    }

    signatureRef.current = signature;
  }, [
    open,
    expectedPhotoCount,
    topicOrderIndexes,
    selectedPhotos,
    photoSelection,
    uploadFlow,
  ]);

  const handleSubmit = useCallback(() => {
    if (isBusy || uploadFlow.uploadComplete) {
      return;
    }
    void form.handleSubmit();
  }, [isBusy, uploadFlow.uploadComplete, form]);

  const handleConfirmOverwrite = useCallback(async () => {
    if (!pendingReference) {
      return;
    }

    setShowOverwriteDialog(false);
    await uploadFlow.runUpload(pendingReference, selectedPhotos);
    setPendingReference(null);
  }, [pendingReference, uploadFlow, selectedPhotos]);

  const onDropAccepted = useCallback(
    (files: File[]) => {
      void photoSelection.handleFileSelect(files);
    },
    [photoSelection],
  );

  const onDropRejected = useCallback(() => {
    toast.error(
      "Some files were rejected. Please use supported image formats.",
    );
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: DROPZONE_ACCEPT,
    disabled: isDropzoneDisabled,
    multiple: true,
    onDropAccepted,
    onDropRejected,
  });

  const handleOpenParticipant = useCallback(() => {
    if (!uploadFlow.submittedReference) {
      return;
    }

    const targetHref = formatDomainPathname(
      `/admin/dashboard/submissions/${uploadFlow.submittedReference}`,
      domain,
    );

    handleDialogOpenChange(false);
    router.push(targetHref);
  }, [domain, handleDialogOpenChange, router, uploadFlow.submittedReference]);

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent
          size="xl"
          className="gap-0 overflow-hidden border-[#deded5] bg-[#f7f7f3] p-0"
        >
          <DialogHeader className="shrink-0 border-b border-[#e2e2d8] bg-[#fbfbf7] px-6 py-4 text-left">
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="font-gothic text-2xl font-normal tracking-tight text-[#242424]">
                  Add Participant Upload
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm text-[#66665f]">
                  Create participant details and upload{" "}
                  {pluralizePhotos(expectedPhotoCount || 0)}
                  {marathonMode === "by-camera"
                    ? " for the active topic"
                    : " with class mapping"}
                  .
                </DialogDescription>
              </div>
              <Badge
                variant="outline"
                className="border-[#d8d8cf] bg-white text-[#5f5f58]"
              >
                {marathonMode === "by-camera" ? "By Camera" : "Marathon"}
              </Badge>
            </div>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1.2fr_1fr]">
            <div className="min-h-0 overflow-y-auto px-6 py-6">
              <div className="space-y-6">
                <ParticipantDetailsForm
                  form={form}
                  marathonMode={marathonMode}
                />
                <UploadMappingSection
                  form={form}
                  marathonMode={marathonMode}
                  competitionClasses={competitionClasses}
                  deviceGroups={deviceGroups}
                  selectedTopics={selectedTopics}
                  isBusy={isBusy}
                />
              </div>
            </div>

            <div className="min-h-0 overflow-y-auto border-l border-[#e2e2d8] bg-[#fcfcf8] px-6 py-6">
              <div className="space-y-5">
                <ImageDropzoneSection
                  getRootProps={getRootProps}
                  getInputProps={getInputProps}
                  isDragActive={isDragActive}
                  isDropzoneDisabled={isDropzoneDisabled}
                  variant={dropzoneVariant}
                  isProcessingFiles={photoSelection.isProcessingFiles}
                  expectedPhotoCount={expectedPhotoCount}
                  selectedPhotosCount={selectedPhotos.length}
                  isMaxImagesReached={isMaxImagesReached}
                  dropzoneDisabledReason={dropzoneDisabledReason}
                  formErrorsFiles={filesError}
                />

                <SelectedImagesSection
                  selectedPhotos={selectedPhotos}
                  expectedPhotoCount={expectedPhotoCount}
                  photoValidationMap={photoSelection.photoValidationMap}
                  generalValidationResults={
                    photoSelection.generalValidationResults
                  }
                  blockingValidationErrors={
                    photoSelection.blockingValidationErrors
                  }
                  warningValidationResults={
                    photoSelection.warningValidationResults
                  }
                  validationRunError={photoSelection.validationRunError}
                  isBusy={isBusy}
                  uploadComplete={uploadFlow.uploadComplete}
                  onRemovePhoto={photoSelection.handleRemovePhoto}
                />

                <UploadStatusSection
                  uploadFiles={uploadFlow.uploadFiles}
                  uploadProgress={uploadFlow.uploadProgress}
                  uploadErrorMessage={uploadFlow.uploadErrorMessage}
                  canRetryFailedUploads={uploadFlow.canRetryFailedUploads}
                  uploadComplete={uploadFlow.uploadComplete}
                  submittedReference={uploadFlow.submittedReference}
                  isUploadingFiles={uploadFlow.isUploadingFiles}
                  isBusy={isBusy}
                  onRetryFailed={uploadFlow.handleRetryFailed}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 flex-row items-center justify-between gap-3 border-t border-[#e2e2d8] bg-[#fbfbf7] px-6 py-4">
            {uploadFlow.uploadComplete ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDialogOpenChange(false)}
                  className="h-9"
                >
                  Close
                </Button>
                <PrimaryButton
                  type="button"
                  onClick={handleOpenParticipant}
                  className="h-9 px-4 py-2 text-sm whitespace-nowrap"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Open Participant
                </PrimaryButton>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDialogOpenChange(false)}
                  disabled={isBusy}
                  className="h-9"
                >
                  Cancel
                </Button>
                <PrimaryButton
                  type="button"
                  onClick={handleSubmit}
                  disabled={isBusy}
                  className="h-9 px-4 py-2 text-sm whitespace-nowrap"
                >
                  {isPrimaryActionBusy ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Create & Upload
                </PrimaryButton>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={showOverwriteDialog}
        onOpenChange={setShowOverwriteDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Participant Reference Exists</AlertDialogTitle>
            <AlertDialogDescription>
              Participant #{pendingReference} already exists. Continuing will
              overwrite initialization data and recreate submissions for this
              reference.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setPendingReference(null);
                setShowOverwriteDialog(false);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmOverwrite}>
              Continue & Overwrite
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
