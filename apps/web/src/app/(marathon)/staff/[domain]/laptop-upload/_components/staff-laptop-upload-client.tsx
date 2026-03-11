"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useDropzone, type Accept } from "react-dropzone";
import { AlertTriangle, ArrowLeft, ArrowRight, Loader2, UploadIcon } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { motion } from "motion/react";

import { useDomain } from "@/lib/domain-provider";
import { useTRPC } from "@/lib/trpc/client";
import { cn, formatDomainPathname } from "@/lib/utils";
import { getExpectedPhotoCount, getSelectedTopics } from "@/lib/upload-mapping";
import { saveParticipantPhotosLocally } from "@/lib/participant-upload/local-save";
import {
  resolveStaffLaptopUploadLookupOutcome,
  type ParticipantExistenceStatus,
} from "@/lib/participant-upload/flow-helpers";
import { getDropzoneDisabledReason, getDropzoneVariant } from "@/lib/participant-upload/upload-utils";
import { revokePhotoPreviewUrls } from "@/lib/participant-upload/file-processing";
import { useParticipantUploadForm } from "@/hooks/use-participant-upload-form";
import { useParticipantPhotoSelection } from "@/hooks/use-participant-photo-selection";
import { useParticipantUploadFlow } from "@/hooks/use-participant-upload-flow";
import { Button } from "@/components/ui/button";
import { PrimaryButton } from "@/components/ui/primary-button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { StaffParticipant } from "../../_lib/staff-types";
import { StepIndicator } from "./step-indicator";
import { ReferenceStep } from "./reference-step";
import { ParticipantDetailsStep } from "./participant-details-step";
import { UploadStep } from "./upload-step";
import { UploadProgressPanel } from "./upload-progress-panel";
import { UploadCompletePanel } from "./upload-complete-panel";

type FlowStep = "reference" | "details" | "upload" | "progress" | "complete";

interface ParticipantDraft {
  reference: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  competitionClassId: string;
  deviceGroupId: string;
}

const DROPZONE_ACCEPT: Accept = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/gif": [".gif"],
  "image/webp": [".webp"],
  "image/heic": [".heic"],
  "image/heif": [".heif"],
};

function getBlockedMessage(status: ParticipantExistenceStatus) {
  if (status === "verified") {
    return "This participant has already been verified and cannot be uploaded again from the staff laptop flow.";
  }

  return "This participant has already completed the upload flow and cannot be uploaded again from the staff laptop flow.";
}

export function StaffLaptopUploadClient() {
  const domain = useDomain();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: marathon } = useSuspenseQuery(
    trpc.marathons.getByDomain.queryOptions({ domain }),
  );
  const marathonMode = marathon.mode as "marathon" | "by-camera";

  const [step, setStep] = useState<FlowStep>("reference");
  const [lookupErrorMessage, setLookupErrorMessage] = useState<string | null>(null);
  const [resolvedReference, setResolvedReference] = useState("");
  const [existingParticipant, setExistingParticipant] = useState<StaffParticipant | null>(null);
  const [participantDraft, setParticipantDraft] = useState<ParticipantDraft | null>(null);
  const [participantStatus, setParticipantStatus] =
    useState<ParticipantExistenceStatus>(null);
  const [requiresOverwriteWarning, setRequiresOverwriteWarning] = useState(false);
  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [isSavingLocally, setIsSavingLocally] = useState(false);

  const lookupParticipantMutation = useMutation(
    trpc.uploadFlow.checkParticipantExists.mutationOptions(),
  );

  const { form, formValues, validateFiles, resetForm } = useParticipantUploadForm(
    marathonMode,
    {
      onSubmit: async (value) => {
        setParticipantDraft(value);
        setResolvedReference(value.reference);
        setLookupErrorMessage(null);
        setStep("upload");
      },
    },
  );

  const sortedTopics = useMemo(
    () => marathon.topics.toSorted((a, b) => a.orderIndex - b.orderIndex),
    [marathon.topics],
  );

  const activeCompetitionClassId = existingParticipant
    ? String(existingParticipant.competitionClassId)
    : participantDraft?.competitionClassId ?? formValues.competitionClassId;
  const activeDeviceGroupId = existingParticipant
    ? String(existingParticipant.deviceGroupId)
    : participantDraft?.deviceGroupId ?? formValues.deviceGroupId;

  const selectedCompetitionClass = useMemo(
    () =>
      marathon.competitionClasses.find(
        (competitionClass) => competitionClass.id === Number(activeCompetitionClassId),
      ) ?? null,
    [activeCompetitionClassId, marathon.competitionClasses],
  );

  const selectedDeviceGroup = useMemo(
    () =>
      marathon.deviceGroups.find(
        (deviceGroup) => deviceGroup.id === Number(activeDeviceGroupId),
      ) ?? null,
    [activeDeviceGroupId, marathon.deviceGroups],
  );

  const selectedTopics = useMemo(
    () =>
      getSelectedTopics(
        marathonMode,
        null,
        selectedCompetitionClass,
        sortedTopics,
      ),
    [marathonMode, selectedCompetitionClass, sortedTopics],
  );

  const expectedPhotoCount = getExpectedPhotoCount(
    marathonMode,
    null,
    selectedCompetitionClass,
  );
  const topicOrderIndexes = selectedTopics.map((topic) => topic.orderIndex);

  const uploadFlow = useParticipantUploadFlow({
    domain,
    marathonMode,
    formValues,
    queryClient,
  });

  const isUploadBusy =
    uploadFlow.isUploadingFiles ||
    uploadFlow.isPollingStatus ||
    uploadFlow.initializeUploadFlowMutation.isPending ||
    uploadFlow.initializeByCameraUploadMutation.isPending;

  const photoSelection = useParticipantPhotoSelection({
    open: step === "upload",
    topicOrderIndexes,
    expectedPhotoCount,
    ruleConfigs: marathon.ruleConfigs,
    marathonStartDate: marathon.startDate ?? null,
    marathonEndDate: marathon.endDate ?? null,
    isUploadBusy,
    uploadComplete: uploadFlow.uploadComplete,
    canSelectFiles: Boolean(selectedCompetitionClass && selectedDeviceGroup),
    onClearFormFilesError: () => setFilesError(null),
    onResetUploadState: () => uploadFlow.resetUploadFlow(),
  });

  const isBusy = lookupParticipantMutation.isPending || isUploadBusy;
  const canSelectFiles = Boolean(selectedCompetitionClass && selectedDeviceGroup);
  const isMaxImagesReached =
    photoSelection.selectedPhotos.length >= expectedPhotoCount &&
    expectedPhotoCount > 0;
  const isDropzoneDisabled =
    !canSelectFiles ||
    isBusy ||
    uploadFlow.uploadComplete ||
    isMaxImagesReached;
  const dropzoneDisabledReason = getDropzoneDisabledReason({
    deviceGroupId: activeDeviceGroupId,
    marathonMode,
    competitionClassId: activeCompetitionClassId,
    activeByCameraTopic: null,
  });
  const dropzoneVariant = getDropzoneVariant({
    canSelectFiles,
    isMaxImagesReached,
    uploadComplete: uploadFlow.uploadComplete,
    isBusy,
  });

  useEffect(() => {
    if (uploadFlow.uploadComplete) {
      setStep("complete");
    }
  }, [uploadFlow.uploadComplete]);

  const participantSummary = useMemo(() => {
    if (existingParticipant && selectedCompetitionClass && selectedDeviceGroup) {
      return {
        reference: existingParticipant.reference,
        firstName: existingParticipant.firstname,
        lastName: existingParticipant.lastname,
        email: existingParticipant.email ?? "",
        phone: "",
        competitionClassName: selectedCompetitionClass.name,
        deviceGroupName: selectedDeviceGroup.name,
        statusLabel:
          participantStatus === "initialized"
            ? "Existing in-progress upload"
            : "Prepared participant",
        statusTone:
          participantStatus === "initialized" ? ("warning" as const) : ("default" as const),
      };
    }

    if (participantDraft && selectedCompetitionClass && selectedDeviceGroup) {
      return {
        reference: participantDraft.reference,
        firstName: participantDraft.firstName,
        lastName: participantDraft.lastName,
        email: participantDraft.email,
        phone: participantDraft.phone,
        competitionClassName: selectedCompetitionClass.name,
        deviceGroupName: selectedDeviceGroup.name,
        statusLabel: "Manual entry",
        statusTone: "default" as const,
      };
    }

    return null;
  }, [
    existingParticipant,
    participantDraft,
    participantStatus,
    selectedCompetitionClass,
    selectedDeviceGroup,
  ]);

  const manualStepTopics = useMemo(() => {
    const competitionClass = marathon.competitionClasses.find(
      (candidate) => candidate.id === Number(formValues.competitionClassId),
    );

    if (!competitionClass) {
      return [];
    }

    return getSelectedTopics(marathonMode, null, competitionClass, sortedTopics);
  }, [formValues.competitionClassId, marathonMode, marathon.competitionClasses, sortedTopics]);

  const handleLookup = async (reference: string) => {
    setLookupErrorMessage(null);

    try {
      const result = await lookupParticipantMutation.mutateAsync({
        domain,
        reference,
      });

      const outcome = resolveStaffLaptopUploadLookupOutcome({
        exists: result.exists,
        status: result.status as ParticipantExistenceStatus,
      });

      setResolvedReference(reference);
      setParticipantStatus(result.status as ParticipantExistenceStatus);

      if (outcome.kind === "blocked") {
        setExistingParticipant(null);
        setParticipantDraft(null);
        setRequiresOverwriteWarning(false);
        setLookupErrorMessage(getBlockedMessage(result.status as ParticipantExistenceStatus));
        setStep("reference");
        return;
      }

      if (outcome.kind === "manual-entry") {
        setExistingParticipant(null);
        setParticipantDraft(null);
        setRequiresOverwriteWarning(false);
        resetForm();
        form.setFieldValue("reference", reference);
        setStep("details");
        return;
      }

      const participant = await queryClient.fetchQuery(
        trpc.participants.getByReference.queryOptions({
          domain,
          reference,
        }),
      );

      setExistingParticipant(participant as StaffParticipant);
      setParticipantDraft(null);
      setRequiresOverwriteWarning(outcome.requiresOverwriteWarning);
      setStep("upload");
    } catch (error) {
      console.error(error);
      setLookupErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to find participant for this reference.",
      );
    }
  };

  const handleSubmitUpload = async () => {
    if (!participantSummary) {
      toast.error("Participant details are missing.");
      return;
    }

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

    const participantPayload = existingParticipant
      ? {
          firstName: existingParticipant.firstname,
          lastName: existingParticipant.lastname,
          email: existingParticipant.email ?? "",
          phone: "",
          competitionClassId: String(existingParticipant.competitionClassId),
          deviceGroupId: String(existingParticipant.deviceGroupId),
        }
      : participantDraft;

    if (!participantPayload) {
      toast.error("Participant details are missing.");
      return;
    }

    if (requiresOverwriteWarning) {
      setShowOverwriteDialog(true);
      return;
    }

    setStep("progress");
    await uploadFlow.runUpload(
      participantSummary.reference,
      photoSelection.selectedPhotos,
      participantPayload,
    );
  };

  const handleConfirmOverwrite = async () => {
    if (!participantSummary || !existingParticipant) {
      return;
    }

    setShowOverwriteDialog(false);
    setStep("progress");
    await uploadFlow.runUpload(
      participantSummary.reference,
      photoSelection.selectedPhotos,
      {
        firstName: existingParticipant.firstname,
        lastName: existingParticipant.lastname,
        email: existingParticipant.email ?? "",
        phone: "",
        competitionClassId: String(existingParticipant.competitionClassId),
        deviceGroupId: String(existingParticipant.deviceGroupId),
      },
    );
  };

  const handleSaveLocally = async () => {
    if (!participantSummary || photoSelection.selectedPhotos.length === 0) {
      return;
    }

    try {
      setIsSavingLocally(true);
      const result = await saveParticipantPhotosLocally({
        domain,
        participantReference: participantSummary.reference,
        photos: photoSelection.selectedPhotos,
      });
      toast.success(
        result.mode === "directory"
          ? "Files saved to the selected folder."
          : "Backup zip downloaded.",
      );
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save files locally.",
      );
    } finally {
      setIsSavingLocally(false);
    }
  };

  const resetAllState = () => {
    revokePhotoPreviewUrls(photoSelection.selectedPhotos);
    photoSelection.setSelectedPhotos([]);
    photoSelection.resetPhotoSelection();
    uploadFlow.resetUploadFlow();
    resetForm();
    setLookupErrorMessage(null);
    setResolvedReference("");
    setExistingParticipant(null);
    setParticipantDraft(null);
    setParticipantStatus(null);
    setRequiresOverwriteWarning(false);
    setShowOverwriteDialog(false);
    setFilesError(null);
    setStep("reference");
  };

  const onDropAccepted = (files: File[]) => {
    void photoSelection.handleFileSelect(files);
  };

  const onDropRejected = () => {
    toast.error("Some files were rejected. Please use supported image formats.");
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: DROPZONE_ACCEPT,
    disabled: isDropzoneDisabled,
    multiple: true,
    onDropAccepted,
    onDropRejected,
  });

  const backUrl = formatDomainPathname("/staff", domain, "staff");
  const showFloatingBar = step === "details" || step === "upload";
  const submitDisabled =
    isBusy ||
    photoSelection.selectedPhotos.length !== expectedPhotoCount ||
    Boolean(photoSelection.blockingValidationErrors.length);

  if (marathon.mode !== "marathon") {
    return (
      <div className="relative min-h-screen">
        <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-lg">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
            <Button asChild variant="ghost" size="sm" className="rounded-full">
              <Link href={backUrl}>
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Back
              </Link>
            </Button>
            <div className="rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground shadow-sm backdrop-blur-sm">
              {domain}
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-3xl px-6 py-10">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <div className="flex items-start gap-4">
              <div className="mt-0.5 shrink-0 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-rocgrotesk text-2xl text-amber-900">
                  Laptop upload unavailable
                </h1>
                <p className="mt-2 text-sm text-amber-800">
                  This staff tool is only available for marathon mode events.
                  By-camera events are not supported.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const hasRecoverableUploadFailure =
    Boolean(uploadFlow.uploadErrorMessage) || uploadFlow.canRetryFailedUploads;

  return (
    <>
      <div className="relative min-h-screen">
        <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-lg">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
            <Button asChild variant="ghost" size="sm" className="rounded-full">
              <Link href={backUrl}>
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                <span className="hidden sm:inline">Back</span>
              </Link>
            </Button>

            <StepIndicator currentFlowStep={step} />

            <div className="rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground shadow-sm backdrop-blur-sm">
              {domain}
            </div>
          </div>
        </header>

        <div className={cn("mx-auto max-w-3xl px-6 py-6", showFloatingBar && "pb-28")}>
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            {step === "reference" ? (
              <ReferenceStep
                defaultReference={resolvedReference}
                isSubmitting={lookupParticipantMutation.isPending}
                errorMessage={lookupErrorMessage}
                onSubmitAction={handleLookup}
              />
            ) : null}

            {step === "details" ? (
              <ParticipantDetailsStep
                reference={resolvedReference}
                form={form}
                competitionClasses={marathon.competitionClasses}
                deviceGroups={marathon.deviceGroups}
                selectedTopics={manualStepTopics}
                isBusy={isBusy}
              />
            ) : null}

            {step === "upload" && participantSummary ? (
              <UploadStep
                participantSummary={participantSummary}
                selectedTopics={selectedTopics}
                requiresOverwriteWarning={requiresOverwriteWarning}
                photoSelection={photoSelection}
                expectedPhotoCount={expectedPhotoCount}
                dropzoneProps={{ getRootProps, getInputProps, isDragActive }}
                dropzoneState={{
                  isDropzoneDisabled,
                  variant: dropzoneVariant,
                  isProcessingFiles: photoSelection.isProcessingFiles,
                  expectedPhotoCount,
                  selectedPhotosCount: photoSelection.selectedPhotos.length,
                  isMaxImagesReached,
                  dropzoneDisabledReason,
                  formErrorsFiles: filesError ?? undefined,
                }}
                isBusy={isBusy}
              />
            ) : null}

            {step === "progress" && participantSummary ? (
              <UploadProgressPanel
                participantSummary={participantSummary}
                files={uploadFlow.uploadFiles}
                completed={uploadFlow.uploadProgress.completed}
                total={uploadFlow.uploadProgress.total}
                isWorking={uploadFlow.isUploadingFiles || uploadFlow.isPollingStatus}
                uploadErrorMessage={uploadFlow.uploadErrorMessage}
                canRetryFailedUploads={uploadFlow.canRetryFailedUploads}
                isRetrying={uploadFlow.isUploadingFiles}
                canSaveLocally={hasRecoverableUploadFailure && !isSavingLocally}
                onRetryAction={() => void uploadFlow.handleRetryFailed()}
                onSaveLocallyAction={() => void handleSaveLocally()}
                onBackAction={() => setStep("upload")}
              />
            ) : null}

            {step === "complete" && participantSummary ? (
              <UploadCompletePanel
                participantSummary={{
                  ...participantSummary,
                  statusLabel: "Uploaded",
                  statusTone: "success",
                }}
                onResetAction={resetAllState}
              />
            ) : null}
          </motion.div>
        </div>
      </div>

      {showFloatingBar ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center p-4">
          <div className="pointer-events-auto flex w-full max-w-3xl items-center justify-between rounded-2xl border border-border bg-background/90 px-5 py-3 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] backdrop-blur-lg">
            {step === "details" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => {
                    setParticipantDraft(null);
                    setStep("reference");
                  }}
                  disabled={isBusy}
                >
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  Back
                </Button>
                <PrimaryButton
                  type="button"
                  className="rounded-full px-6"
                  onClick={() => void form.handleSubmit()}
                  disabled={isBusy}
                >
                  Continue to photos
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </PrimaryButton>
              </>
            ) : null}

            {step === "upload" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => {
                    setFilesError(null);
                    setStep(existingParticipant ? "reference" : "details");
                  }}
                  disabled={isBusy}
                >
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  Back
                </Button>
                <PrimaryButton
                  type="button"
                  className="min-w-[180px] rounded-full px-6"
                  onClick={() => void handleSubmitUpload()}
                  disabled={submitDisabled}
                >
                  {isUploadBusy ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <UploadIcon className="mr-2 h-4 w-4" />
                  )}
                  Start upload
                </PrimaryButton>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      <AlertDialog open={showOverwriteDialog} onOpenChange={setShowOverwriteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace existing in-progress upload?</AlertDialogTitle>
            <AlertDialogDescription>
              Participant #{resolvedReference} already has an initialized upload.
              Continuing will recreate the submission set for this participant.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmOverwrite()}>
              Continue and replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
