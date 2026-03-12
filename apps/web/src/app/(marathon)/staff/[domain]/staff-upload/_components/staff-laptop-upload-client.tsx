"use client";

import { useEffect } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Loader2,
  UploadIcon,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { motion } from "motion/react";

import { useDomain } from "@/lib/domain-provider";
import { useTRPC } from "@/lib/trpc/client";
import { cn, formatDomainPathname } from "@/lib/utils";
import { getExpectedPhotoCount } from "@/lib/upload-mapping";
import {
  resolveStaffLaptopUploadLookupOutcome,
  type ParticipantExistenceStatus,
} from "@/lib/participant-upload/flow-helpers";
import {
  PARTICIPANT_UPLOAD_PHASE,
  type ParticipantPreparedUpload,
  type ParticipantSelectedPhoto,
  type ParticipantUploadFileState,
} from "@/lib/participant-upload/types";
import { uploadPreparedFiles } from "@/lib/participant-upload/upload-runner";
import { Button } from "@/components/ui/button";
import { PrimaryButton } from "@/components/ui/primary-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { normalizeParticipantReference } from "../../_lib/staff-utils";
import type { StaffParticipant } from "../../_lib/staff-types";
import { useStaffUploadParticipantSummary } from "../_hooks/use-staff-upload-participant-summary";
import { useStaffUploadStep } from "../_hooks/use-staff-upload-step";
import { useStaffPhotoValidation } from "../_hooks/use-staff-photo-validation";
import { useUploadStatusSync } from "../_hooks/use-upload-status-sync";
import {
  validateStaffUploadFiles,
  validateStaffUploadForm,
} from "../_lib/staff-upload-form";
import {
  useStaffUploadStore,
  selectRequiresOverwriteWarning,
} from "../_lib/staff-upload-store";
import { ParticipantDetailsStep } from "./participant-details-step";
import { ReferenceStep } from "./reference-step";
import { StepIndicator } from "./step-indicator";
import { UploadCompletePanel } from "./upload-complete-panel";
import { UploadProgressPanel } from "./upload-progress-panel";
import { UploadStep } from "./upload-step";

const POLLING_INTERVAL_MS = 3000;

interface StaffLaptopUploadClientProps {
  staffEmail?: string | null;
  staffImage?: string | null;
  staffName?: string | null;
}

function getStaffInitials(name?: string | null, email?: string | null) {
  const source = (name || email || "Staff").trim();
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "ST";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}

function getBlockedMessage(status: ParticipantExistenceStatus) {
  if (status === "verified") {
    return "This participant has already been verified and cannot be uploaded again from the staff laptop flow.";
  }

  return "This participant has already completed the upload flow and cannot be uploaded again from the staff laptop flow.";
}

export function StaffLaptopUploadClient({
  staffEmail,
  staffImage,
  staffName,
}: StaffLaptopUploadClientProps) {
  const domain = useDomain();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [step, setStep] = useStaffUploadStep();

  // -- participant state ----------------------------------------------------
  const formValues = useStaffUploadStore((s) => s.formValues);
  const existingParticipant = useStaffUploadStore((s) => s.existingParticipant);
  const showOverwriteDialog = useStaffUploadStore((s) => s.showOverwriteDialog);
  const requiresOverwriteWarning = useStaffUploadStore(
    selectRequiresOverwriteWarning,
  );

  const resetForm = useStaffUploadStore((s) => s.resetForm);
  const setFormField = useStaffUploadStore((s) => s.setFormField);
  const setFormErrors = useStaffUploadStore((s) => s.setFormErrors);
  const clearFormErrors = useStaffUploadStore((s) => s.clearFormErrors);
  const patchParticipant = useStaffUploadStore((s) => s.patchParticipant);

  // -- photo state ----------------------------------------------------------
  const selectedPhotos = useStaffUploadStore((s) => s.selectedPhotos);
  const validationResults = useStaffUploadStore((s) => s.validationResults);
  const validationRunError = useStaffUploadStore((s) => s.validationRunError);

  const resetPhotoSelection = useStaffUploadStore((s) => s.resetPhotoSelection);
  const patchPhotos = useStaffUploadStore((s) => s.patchPhotos);

  // -- upload state ---------------------------------------------------------
  const uploadFiles = useStaffUploadStore((s) => s.uploadFiles);
  const submittedReference = useStaffUploadStore((s) => s.submittedReference);
  const isUploadingFiles = useStaffUploadStore((s) => s.isUploadingFiles);
  const isPollingStatus = useStaffUploadStore((s) => s.isPollingStatus);
  const uploadComplete = useStaffUploadStore((s) => s.uploadComplete);

  const updateUploadFileState = useStaffUploadStore(
    (s) => s.updateUploadFileState,
  );
  const resetUploadFlow = useStaffUploadStore((s) => s.resetUploadFlow);
  const patchUpload = useStaffUploadStore((s) => s.patchUpload);

  // -- global ---------------------------------------------------------------
  const resetAllState = useStaffUploadStore((s) => s.resetAllState);

  const { data: marathon } = useSuspenseQuery(
    trpc.marathons.getByDomain.queryOptions({ domain }),
  );
  const marathonMode = marathon.mode as "marathon" | "by-camera";

  const lookupParticipantMutation = useMutation(
    trpc.uploadFlow.checkParticipantExists.mutationOptions(),
  );
  const initializeUploadFlowMutation = useMutation(
    trpc.uploadFlow.initializeUploadFlow.mutationOptions(),
  );
  const initializeByCameraUploadMutation = useMutation(
    trpc.uploadFlow.initializeByCameraUpload.mutationOptions(),
  );

  const activeCompetitionClassId = existingParticipant
    ? String(existingParticipant.competitionClassId)
    : formValues.competitionClassId;
  const activeDeviceGroupId = existingParticipant
    ? String(existingParticipant.deviceGroupId)
    : formValues.deviceGroupId;

  const selectedCompetitionClass =
    marathon.competitionClasses.find(
      (cc) => cc.id === Number(activeCompetitionClassId),
    ) ?? null;
  const selectedDeviceGroup =
    marathon.deviceGroups.find((dg) => dg.id === Number(activeDeviceGroupId)) ??
    null;

  const expectedPhotoCount = getExpectedPhotoCount(
    marathonMode,
    null,
    selectedCompetitionClass,
  );

  const participantSummary = useStaffUploadParticipantSummary();

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

  const isUploadBusy =
    isUploadingFiles ||
    isPollingStatus ||
    initializeUploadFlowMutation.isPending ||
    initializeByCameraUploadMutation.isPending;
  const isBusy = lookupParticipantMutation.isPending || isUploadBusy;
  const canSelectFiles = Boolean(
    selectedCompetitionClass && selectedDeviceGroup,
  );
  const isMaxImagesReached =
    selectedPhotos.length >= expectedPhotoCount && expectedPhotoCount > 0;
  const isDropzoneDisabled =
    !canSelectFiles || isBusy || uploadComplete || isMaxImagesReached;

  useEffect(() => {
    resetAllState();
    void setStep("reference");

    return () => {
      resetAllState();
    };
  }, [resetAllState, setStep]);

  useEffect(() => {
    if (step === "reference") return;

    if (step === "details" && !formValues.reference) {
      void setStep("reference");
      return;
    }

    if (
      (step === "upload" || step === "progress" || step === "complete") &&
      !participantSummary
    ) {
      void setStep(formValues.reference ? "details" : "reference");
    }
  }, [formValues.reference, participantSummary, setStep, step]);

  useStaffPhotoValidation({
    step,
    ruleConfigs: marathon.ruleConfigs,
    marathonStartDate: marathon.startDate,
    marathonEndDate: marathon.endDate,
  });

  const { resetCompletion } = useUploadStatusSync({
    domain,
    uploadStatusData: uploadStatusQuery.data,
    refetchUploadStatus: async () => {
      await uploadStatusQuery.refetch();
    },
    setStep,
  });

  async function runUpload(
    reference: string,
    photos: ParticipantSelectedPhoto[],
    participantDraft?: Partial<typeof formValues>,
  ) {
    if (photos.length === 0) return;

    const resolvedFormValues = {
      ...formValues,
      ...participantDraft,
      reference,
    };

    patchUpload({
      uploadErrorMessage: null,
      uploadComplete: false,
      isUploadingFiles: true,
      isPollingStatus: false,
    });
    resetCompletion();

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
              phoneNumber: commonPayload.phoneNumber || null,
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

      const preparedUploads: ParticipantPreparedUpload[] = photos.map(
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

      patchUpload({
        uploadFiles: initialUploadState,
        submittedReference: resolvedReference,
      });

      const { successKeys, failedKeys } = await uploadPreparedFiles({
        files: preparedUploads,
        onFileStateChange: updateUploadFileState,
      });

      if (successKeys.length > 0) {
        patchUpload({ isPollingStatus: true });
      }

      if (failedKeys.length === 0) return;

      const message = `${failedKeys.length} photo${
        failedKeys.length === 1 ? "" : "s"
      } failed to upload`;
      patchUpload({ uploadErrorMessage: message });
      toast.error(message);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to initialize upload";
      patchUpload({ uploadErrorMessage: message });
      toast.error(message);
    } finally {
      patchUpload({ isUploadingFiles: false });
    }
  }

  const handleLookup = async (reference: string) => {
    const normalizedReference = normalizeParticipantReference(reference);

    setFormField("reference", normalizedReference);
    patchParticipant({ lookupErrorMessage: null, showOverwriteDialog: false });
    patchPhotos({ filesError: null });
    resetPhotoSelection();
    resetUploadFlow();

    try {
      const result = await lookupParticipantMutation.mutateAsync({
        domain,
        reference: normalizedReference,
      });

      const resolvedStatus = result.status as ParticipantExistenceStatus;
      const outcome = resolveStaffLaptopUploadLookupOutcome({
        exists: result.exists,
        status: resolvedStatus,
      });

      patchParticipant({ participantStatus: resolvedStatus });

      if (outcome.kind === "blocked") {
        patchParticipant({
          existingParticipant: null,
          lookupErrorMessage: getBlockedMessage(resolvedStatus),
        });
        resetForm(normalizedReference);
        void setStep("reference");
        return;
      }

      if (outcome.kind === "manual-entry") {
        patchParticipant({ existingParticipant: null });
        resetForm(normalizedReference);
        clearFormErrors();
        void setStep("details");
        return;
      }

      const participant = await queryClient.fetchQuery(
        trpc.participants.getByReference.queryOptions({
          domain,
          reference: normalizedReference,
        }),
      );

      patchParticipant({
        existingParticipant: participant as StaffParticipant,
      });
      void setStep("upload");
    } catch (error) {
      console.error(error);
      patchParticipant({
        lookupErrorMessage:
          error instanceof Error
            ? error.message
            : "Failed to find participant for this reference.",
      });
    }
  };

  const handleContinueFromDetails = () => {
    const errors = validateStaffUploadForm(marathonMode, formValues);

    if (errors) {
      setFormErrors(errors);
      return;
    }

    clearFormErrors();
    patchParticipant({ lookupErrorMessage: null });
    void setStep("upload");
  };

  const handleSubmitUpload = async () => {
    if (!participantSummary) {
      toast.error("Participant details are missing.");
      return;
    }

    const filesValidationError = validateStaffUploadFiles({
      expectedPhotoCount,
      selectedPhotosCount: selectedPhotos.length,
      validationResults,
      validationRunError,
    });

    if (filesValidationError) {
      patchPhotos({ filesError: filesValidationError });
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
      : formValues;

    if (requiresOverwriteWarning) {
      patchParticipant({ showOverwriteDialog: true });
      return;
    }

    void setStep("progress");
    await runUpload(
      participantSummary.reference,
      selectedPhotos,
      participantPayload,
    );
  };

  const handleConfirmOverwrite = async () => {
    if (!participantSummary || !existingParticipant) return;

    patchParticipant({ showOverwriteDialog: false });
    void setStep("progress");
    await runUpload(participantSummary.reference, selectedPhotos, {
      firstName: existingParticipant.firstname,
      lastName: existingParticipant.lastname,
      email: existingParticipant.email ?? "",
      phone: "",
      competitionClassId: String(existingParticipant.competitionClassId),
      deviceGroupId: String(existingParticipant.deviceGroupId),
    });
  };

  const backUrl = formatDomainPathname("/staff", domain, "staff");
  const showFloatingBar = step === "details" || step === "upload";
  const submitDisabled =
    isBusy ||
    selectedPhotos.length !== expectedPhotoCount ||
    validationResults.some(
      (result) => result.outcome === "failed" && result.severity === "error",
    );

  if (marathon.mode !== "marathon") {
    return (
      <div className="relative min-h-screen">
        <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-lg">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
            <Button asChild variant="ghost" size="sm" className="rounded-full">
              <Link href={backUrl}>
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Back
              </Link>
            </Button>
            <div className="flex items-center gap-2.5">
              <span className="hidden text-sm font-medium text-muted-foreground sm:inline">
                {marathon.name}
              </span>
              <Avatar className="h-7 w-7 ring-1 ring-border">
                {staffImage ? (
                  <AvatarImage src={staffImage} alt={staffName ?? ""} />
                ) : null}
                <AvatarFallback className="bg-muted text-[10px] font-semibold">
                  {getStaffInitials(staffName, staffEmail)}
                </AvatarFallback>
              </Avatar>
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
                  Staff upload unavailable
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

  return (
    <>
      <div className="relative min-h-screen">
        <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-lg">
          <div className="relative mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="relative z-10 rounded-full"
            >
              <Link href={backUrl}>
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                <span className="hidden sm:inline">Back</span>
              </Link>
            </Button>

            <div className="absolute inset-0 flex items-center justify-center">
              <StepIndicator />
            </div>

            <div className="relative z-10 flex items-center gap-2.5">
              <span className="hidden text-sm font-medium text-muted-foreground sm:inline">
                {marathon.name}
              </span>
              <Avatar className="h-7 w-7 ring-1 ring-border">
                {staffImage ? (
                  <AvatarImage src={staffImage} alt={staffName ?? ""} />
                ) : null}
                <AvatarFallback className="bg-muted text-[10px] font-semibold">
                  {getStaffInitials(staffName, staffEmail)}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        <div
          className={cn(
            "mx-auto max-w-3xl px-6 py-6",
            showFloatingBar && "pb-28",
          )}
        >
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            {step === "reference" ? (
              <ReferenceStep
                isSubmitting={lookupParticipantMutation.isPending}
                onSubmitAction={handleLookup}
              />
            ) : null}

            {step === "details" ? (
              <ParticipantDetailsStep isBusy={isBusy} />
            ) : null}

            {step === "upload" ? (
              <UploadStep
                isBusy={isBusy}
                dropzoneDisabled={isDropzoneDisabled}
              />
            ) : null}

            {step === "progress" ? <UploadProgressPanel /> : null}

            {step === "complete" ? <UploadCompletePanel /> : null}
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
                    resetForm(formValues.reference);
                    patchParticipant({
                      lookupErrorMessage: null,
                      existingParticipant: null,
                      participantStatus: null,
                    });
                    patchPhotos({ filesError: null });
                    void setStep("reference");
                  }}
                  disabled={isBusy}
                >
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  Back
                </Button>
                <PrimaryButton
                  type="button"
                  className="rounded-full px-6"
                  onClick={handleContinueFromDetails}
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
                    patchPhotos({ filesError: null });

                    if (existingParticipant) {
                      resetPhotoSelection();
                      resetUploadFlow();
                      patchParticipant({
                        existingParticipant: null,
                        participantStatus: null,
                        showOverwriteDialog: false,
                      });
                      void setStep("reference");
                      return;
                    }

                    void setStep("details");
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

      <AlertDialog
        open={showOverwriteDialog}
        onOpenChange={(open) => patchParticipant({ showOverwriteDialog: open })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace existing upload?</AlertDialogTitle>
            <AlertDialogDescription>
              This participant already has an upload in progress. Starting again
              will replace that upload.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUploadBusy}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isUploadBusy}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmOverwrite();
              }}
            >
              Replace and upload
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
