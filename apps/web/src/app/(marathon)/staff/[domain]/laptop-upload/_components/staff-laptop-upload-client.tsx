"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useDropzone, type Accept } from "react-dropzone";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { useDomain } from "@/lib/domain-provider";
import { useTRPC } from "@/lib/trpc/client";
import { formatDomainPathname } from "@/lib/utils";
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { StaffParticipant } from "../../_lib/staff-types";
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

  if (marathon.mode !== "marathon") {
    return (
      <div className="min-h-screen bg-[#f6f3eb] px-6 py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <Button asChild variant="ghost" className="rounded-full">
            <Link href={formatDomainPathname("/staff", domain, "staff")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to staff desk
            </Link>
          </Button>

          <div className="rounded-[2rem] border border-[#ddd8ca] bg-white/92 p-10 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="rounded-full border border-amber-200 bg-amber-50 p-3 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#7a7566]">
                  Unsupported mode
                </p>
                <h1 className="font-rocgrotesk text-4xl leading-none text-[#1d1b17]">
                  Laptop upload is only available for marathon mode
                </h1>
                <p className="text-sm text-[#666152]">
                  This staff tool expects competition classes and topic ranges,
                  so it is intentionally disabled for by-camera events.
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
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(250,246,236,0.96),rgba(247,244,237,0.92)_26%,rgba(242,239,231,0.92)_60%,rgba(239,235,226,0.95)_100%)] px-6 py-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button asChild variant="ghost" className="rounded-full">
              <Link href={formatDomainPathname("/staff", domain, "staff")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to staff desk
              </Link>
            </Button>
            <div className="rounded-full border border-white/70 bg-white/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#6f695b] shadow-sm backdrop-blur-sm">
              {domain} laptop upload
            </div>
          </div>

          <header className="rounded-[2rem] border border-[#ddd8ca] bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(247,241,228,0.92))] px-8 py-9 shadow-[0_30px_90px_rgba(28,24,18,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#7a7566]">
              Staff laptop uploader
            </p>
            <h1 className="mt-4 max-w-3xl font-rocgrotesk text-6xl leading-[0.92] text-[#171511]">
              Help participants upload from SD cards on a laptop
            </h1>
            <p className="mt-4 max-w-2xl text-sm text-[#666152]">
              Look up a participant by number, reuse prepared details when
              available, or enter the participant manually and upload the exact
              class-mapped image set.
            </p>
          </header>

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
              form={form}
              competitionClasses={marathon.competitionClasses}
              deviceGroups={marathon.deviceGroups}
              selectedTopics={manualStepTopics}
              isBusy={isBusy}
              onBackAction={() => {
                setParticipantDraft(null);
                setStep("reference");
              }}
              onContinueAction={() => void form.handleSubmit()}
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
              isSubmitting={isUploadBusy}
              submitDisabled={
                isBusy ||
                photoSelection.selectedPhotos.length !== expectedPhotoCount ||
                Boolean(photoSelection.blockingValidationErrors.length)
              }
              onBackAction={() => {
                setFilesError(null);
                setStep(existingParticipant ? "reference" : "details");
              }}
              onSubmitAction={() => void handleSubmitUpload()}
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
        </div>
      </div>

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
