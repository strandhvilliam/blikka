"use client";

import { useEffect, useRef, useState } from "react";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useDropzone, type Accept } from "react-dropzone";
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
import { getExpectedPhotoCount, getSelectedTopics } from "@/lib/upload-mapping";
import { revokePhotoPreviewUrls } from "../_lib/file-processing";
import {
  getDropzoneDisabledReason,
  getDropzoneVariant,
} from "../_lib/upload-utils";
import {
  pluralizePhotos,
  useParticipantUploadForm,
} from "../_hooks/use-participant-upload-form";
import { usePhotoSelection } from "../_hooks/use-photo-selection";
import { useUploadFlow } from "../_hooks/use-upload-flow";
import { ParticipantDetailsForm } from "./participant-details-form";
import { UploadMappingSection } from "./upload-mapping-section";
import { ImageDropzoneSection } from "./image-dropzone-section";
import { SelectedImagesSection } from "./selected-images-section";
import { UploadStatusSection } from "./upload-status-section";
import { useDomain } from "@/lib/domain-provider";

const DROPZONE_ACCEPT: Accept = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/gif": [".gif"],
  "image/webp": [".webp"],
  "image/heic": [".heic"],
  "image/heif": [".heif"],
};

interface AdminParticipantUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminParticipantUploadDialog({
  open,
  onOpenChange,
}: AdminParticipantUploadDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const domain = useDomain();
  const { data: marathon } = useSuspenseQuery(
    trpc.marathons.getByDomain.queryOptions({ domain }),
  );

  const signatureRef = useRef<string | null>(null);

  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false);
  const [pendingReference, setPendingReference] = useState<string | null>(null);
  const [filesError, setFilesError] = useState<string | null>(null);
  const submitLogicRef =
    useRef<
      (value: { reference: string } & Record<string, string>) => Promise<void>
    >(null);

  const checkParticipantExistsMutation = useMutation(
    trpc.uploadFlow.checkParticipantExists.mutationOptions(),
  );

  const { form, formValues, validateFiles, resetForm } =
    useParticipantUploadForm(marathon.mode, {
      onSubmit: async (value) => {
        await submitLogicRef.current?.(value);
      },
    });

  const sortedTopics = marathon.topics.toSorted(
    (a, b) => a.orderIndex - b.orderIndex,
  );
  const activeByCameraTopic =
    sortedTopics.find((topic) => topic.visibility === "active") ?? null;
  const selectedCompetitionClass =
    marathon.competitionClasses.find(
      (competitionClass) =>
        competitionClass.id === Number(formValues.competitionClassId),
    ) ?? null;

  const selectedTopics = getSelectedTopics(
    marathon.mode,
    activeByCameraTopic,
    selectedCompetitionClass,
    sortedTopics,
  );

  const expectedPhotoCount = getExpectedPhotoCount(
    marathon.mode,
    activeByCameraTopic,
    selectedCompetitionClass,
  );

  const topicOrderIndexes = selectedTopics.map((topic) => topic.orderIndex);

  const isMappingReady =
    !!formValues.deviceGroupId &&
    (marathon.mode === "marathon"
      ? !!formValues.competitionClassId
      : !!activeByCameraTopic);

  const dropzoneDisabledReason = getDropzoneDisabledReason({
    deviceGroupId: formValues.deviceGroupId,
    marathonMode: marathon.mode,
    competitionClassId: formValues.competitionClassId,
    activeByCameraTopic,
  });

  const canSelectFiles = isMappingReady && expectedPhotoCount > 0;

  const uploadFlow = useUploadFlow({
    domain,
    marathonMode: marathon.mode,
    formValues,
    queryClient,
  });

  const isUploadBusy =
    uploadFlow.isUploadingFiles ||
    uploadFlow.isPollingStatus ||
    uploadFlow.initializeUploadFlowMutation.isPending ||
    uploadFlow.initializeByCameraUploadMutation.isPending;

  const photoSelection = usePhotoSelection({
    open,
    topicOrderIndexes,
    expectedPhotoCount,
    ruleConfigs: marathon.ruleConfigs,
    marathonStartDate: marathon.startDate ?? null,
    marathonEndDate: marathon.endDate ?? null,
    isUploadBusy,
    uploadComplete: uploadFlow.uploadComplete,
    canSelectFiles,
    onClearFormFilesError: () => setFilesError(null),
    onResetUploadState: () => uploadFlow.resetUploadFlow(),
  });

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
    photoSelection.selectedPhotos.length >= expectedPhotoCount &&
    expectedPhotoCount > 0;
  const isDropzoneDisabled =
    !canSelectFiles ||
    isBusy ||
    uploadFlow.uploadComplete ||
    isMaxImagesReached;

  const dropzoneVariant = getDropzoneVariant({
    canSelectFiles,
    isMaxImagesReached,
    uploadComplete: uploadFlow.uploadComplete,
    isBusy,
  });

  useEffect(() => {
    submitLogicRef.current = async (formValue) => {
      setFilesError(null);
      const filesValidationError = validateFiles({
        expectedPhotoCount,
        selectedPhotosCount: photoSelection.selectedPhotos.length,
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
        await uploadFlow.runUpload(
          formValue.reference,
          photoSelection.selectedPhotos,
        );
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
    photoSelection.selectedPhotos,
    photoSelection.validationResults,
    photoSelection.validationRunError,
    checkParticipantExistsMutation,
    uploadFlow,
    validateFiles,
  ]);

  const resetDialogState = () => {
    resetForm();
    setFilesError(null);
    photoSelection.resetPhotoSelection();
    uploadFlow.resetUploadFlow();
    setPendingReference(null);
    setShowOverwriteDialog(false);
    signatureRef.current = null;
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetDialogState();
    }
    onOpenChange(nextOpen);
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    const signature = `${expectedPhotoCount}:${topicOrderIndexes.join(",")}`;

    if (!signatureRef.current) {
      signatureRef.current = signature;
      return;
    }

    if (
      signatureRef.current !== signature &&
      photoSelection.selectedPhotos.length > 0
    ) {
      revokePhotoPreviewUrls(photoSelection.selectedPhotos);
      photoSelection.setSelectedPhotos([]);
      uploadFlow.resetUploadFlow();
      toast.message(
        "Image selection cleared because class/topic mapping changed",
      );
    }

    signatureRef.current = signature;
  }, [open, expectedPhotoCount, topicOrderIndexes, photoSelection, uploadFlow]);

  const handleSubmit = () => {
    if (isBusy || uploadFlow.uploadComplete) {
      return;
    }
    void form.handleSubmit();
  };

  const handleConfirmOverwrite = async () => {
    if (!pendingReference) {
      return;
    }

    setShowOverwriteDialog(false);
    await uploadFlow.runUpload(pendingReference, photoSelection.selectedPhotos);
    setPendingReference(null);
  };

  const onDropAccepted = (files: File[]) => {
    void photoSelection.handleFileSelect(files);
  };

  const onDropRejected = () => {
    toast.error(
      "Some files were rejected. Please use supported image formats.",
    );
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: DROPZONE_ACCEPT,
    disabled: isDropzoneDisabled,
    multiple: true,
    onDropAccepted,
    onDropRejected,
  });

  const handleOpenParticipant = () => {
    if (!uploadFlow.submittedReference) {
      return;
    }

    const targetHref = formatDomainPathname(
      `/admin/dashboard/submissions/${uploadFlow.submittedReference}`,
      domain,
    );

    handleDialogOpenChange(false);
    router.push(targetHref);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent
          size="xl"
          className="gap-0 overflow-hidden border-[#deded5] bg-[#f7f7f3] p-0"
        >
          <DialogHeader className="shrink-0 border-b border-[#e2e2d8] bg-[#fbfbf7] px-6 py-4 text-left">
            <div className="flex items-start justify-start gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="font-gothic text-2xl font-normal tracking-tight text-[#242424]">
                    Add Participant Upload
                  </DialogTitle>
                  <Badge
                    variant="outline"
                    className="border-[#d8d8cf] bg-white text-[#5f5f58]"
                  >
                    {marathon.mode === "by-camera" ? "By Camera" : "Marathon"}
                  </Badge>
                </div>
                <DialogDescription className="mt-1 text-sm text-[#66665f]">
                  Create participant details and upload{" "}
                  {pluralizePhotos(expectedPhotoCount || 0)}
                  {marathon.mode === "by-camera"
                    ? " for the active topic"
                    : " with class mapping"}
                  .
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1.2fr_1fr]">
            <div className="min-h-0 overflow-y-auto px-6 py-6">
              <div className="space-y-6">
                <ParticipantDetailsForm
                  form={form}
                  marathonMode={marathon.mode}
                />
                <UploadMappingSection
                  form={form}
                  marathonMode={marathon.mode}
                  competitionClasses={marathon.competitionClasses}
                  deviceGroups={marathon.deviceGroups}
                  selectedTopics={selectedTopics}
                  isBusy={isBusy}
                />
              </div>
            </div>

            <div className="min-h-0 overflow-y-auto border-l border-[#e2e2d8] bg-[#fcfcf8] px-6 py-6">
              <div className="space-y-5">
                <ImageDropzoneSection
                  dropzoneProps={{ getRootProps, getInputProps, isDragActive }}
                  dropzoneState={{
                    isDropzoneDisabled: isDropzoneDisabled,
                    variant: dropzoneVariant,
                    isProcessingFiles: photoSelection.isProcessingFiles,
                    expectedPhotoCount,
                    selectedPhotosCount: photoSelection.selectedPhotos.length,
                    isMaxImagesReached,
                    dropzoneDisabledReason,
                    formErrorsFiles: filesError ?? undefined,
                  }}
                />

                <SelectedImagesSection
                  photoSelection={photoSelection}
                  uploadFlow={{ uploadComplete: uploadFlow.uploadComplete }}
                  expectedPhotoCount={expectedPhotoCount}
                  isBusy={isBusy}
                />

                <UploadStatusSection uploadFlow={uploadFlow} isBusy={isBusy} />
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
