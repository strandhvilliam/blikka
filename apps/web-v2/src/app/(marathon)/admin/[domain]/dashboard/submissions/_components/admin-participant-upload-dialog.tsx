"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type {
  CompetitionClass,
  DeviceGroup,
  RuleConfig,
  Topic,
} from "@blikka/db";
import { VALIDATION_OUTCOME, type ValidationResult } from "@blikka/validation";
import { isPossiblePhoneNumber } from "react-phone-number-input";
import {
  Camera,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import { PhoneInput } from "@/components/ui/phone-input";

import { cn, formatDomainPathname } from "@/lib/utils";
import { useTRPC } from "@/lib/trpc/client";
import {
  ADMIN_COMMON_IMAGE_EXTENSIONS,
  ADMIN_UPLOAD_PHASE,
  type AdminPreparedUpload,
  type AdminSelectedPhoto,
  type AdminUploadFileState,
} from "../_lib/admin-upload/types";
import {
  processSelectedFiles,
  reassignPhotoOrderIndexes,
  revokePhotoPreviewUrls,
} from "../_lib/admin-upload/file-processing";
import {
  hasBlockingValidationErrors,
  runAdminPhotoValidation,
} from "../_lib/admin-upload/validation";
import { uploadPreparedFiles } from "../_lib/admin-upload/upload-runner";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POLLING_INTERVAL_MS = 3000;

type MarathonMode = "marathon" | "by-camera";

interface FormState {
  reference: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  competitionClassId: string;
  deviceGroupId: string;
}

type FormErrors = Partial<Record<keyof FormState | "files", string>>;

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

const DEFAULT_FORM_VALUES: FormState = {
  reference: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  competitionClassId: "",
  deviceGroupId: "",
};

function formatRuleKey(ruleKey: string) {
  return ruleKey
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function getUploadPhaseLabel(phase: AdminUploadFileState["phase"]) {
  if (phase === ADMIN_UPLOAD_PHASE.PRESIGNED) return "Ready";
  if (phase === ADMIN_UPLOAD_PHASE.UPLOADING) return "Uploading";
  if (phase === ADMIN_UPLOAD_PHASE.PROCESSING) return "Processing";
  if (phase === ADMIN_UPLOAD_PHASE.COMPLETED) return "Completed";
  if (phase === ADMIN_UPLOAD_PHASE.ERROR) return "Failed";
  return "Unknown";
}

function getUploadPhaseClassName(phase: AdminUploadFileState["phase"]) {
  if (phase === ADMIN_UPLOAD_PHASE.COMPLETED) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (phase === ADMIN_UPLOAD_PHASE.ERROR) {
    return "bg-rose-50 text-rose-700 border-rose-200";
  }
  if (
    phase === ADMIN_UPLOAD_PHASE.UPLOADING ||
    phase === ADMIN_UPLOAD_PHASE.PROCESSING
  ) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function pluralizePhotos(count: number) {
  return `${count} photo${count === 1 ? "" : "s"}`;
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const completionHandledRef = useRef(false);
  const signatureRef = useRef<string | null>(null);
  const photosRef = useRef<AdminSelectedPhoto[]>([]);

  const [formValues, setFormValues] = useState<FormState>(DEFAULT_FORM_VALUES);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [selectedPhotos, setSelectedPhotos] = useState<AdminSelectedPhoto[]>(
    [],
  );

  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [validationResults, setValidationResults] = useState<
    ValidationResult[]
  >([]);
  const [validationRunError, setValidationRunError] = useState<string | null>(
    null,
  );

  const [uploadFiles, setUploadFiles] = useState<AdminUploadFileState[]>([]);
  const [submittedReference, setSubmittedReference] = useState("");
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [isPollingStatus, setIsPollingStatus] = useState(false);
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(
    null,
  );
  const [uploadComplete, setUploadComplete] = useState(false);

  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false);
  const [pendingReference, setPendingReference] = useState<string | null>(null);

  const checkParticipantExistsMutation = useMutation(
    trpc.uploadFlow.checkParticipantExists.mutationOptions(),
  );
  const initializeUploadFlowMutation = useMutation(
    trpc.uploadFlow.initializeUploadFlow.mutationOptions(),
  );
  const initializeByCameraUploadMutation = useMutation(
    trpc.uploadFlow.initializeByCameraUpload.mutationOptions(),
  );

  const sortedTopics = useMemo(
    () => [...topics].sort((a, b) => a.orderIndex - b.orderIndex),
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

  const blockingValidationErrors = useMemo(
    () =>
      validationResults.filter(
        (result) =>
          result.outcome === VALIDATION_OUTCOME.FAILED &&
          result.severity === "error",
      ),
    [validationResults],
  );

  const warningValidationResults = useMemo(
    () =>
      validationResults.filter(
        (result) =>
          result.outcome === VALIDATION_OUTCOME.FAILED &&
          result.severity === "warning",
      ),
    [validationResults],
  );

  const canRetryFailedUploads = useMemo(
    () => uploadFiles.some((file) => file.phase === ADMIN_UPLOAD_PHASE.ERROR),
    [uploadFiles],
  );

  const uploadProgress = useMemo(() => {
    if (uploadFiles.length === 0) {
      return {
        completed: 0,
        total: 0,
      };
    }

    const completed = uploadFiles.filter(
      (file) => file.phase === ADMIN_UPLOAD_PHASE.COMPLETED,
    ).length;

    return {
      completed,
      total: uploadFiles.length,
    };
  }, [uploadFiles]);

  const isBusy =
    isProcessingFiles ||
    isUploadingFiles ||
    isPollingStatus ||
    checkParticipantExistsMutation.isPending ||
    initializeUploadFlowMutation.isPending ||
    initializeByCameraUploadMutation.isPending;

  const updateUploadFileState = useCallback(
    (
      key: string,
      patch: Partial<
        Pick<AdminUploadFileState, "phase" | "progress" | "error">
      >,
    ) => {
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
    },
    [],
  );

  const resetDialogState = useCallback(() => {
    setFormValues(DEFAULT_FORM_VALUES);
    setFormErrors({});

    setSelectedPhotos((current) => {
      revokePhotoPreviewUrls(current);
      return [];
    });

    setValidationResults([]);
    setValidationRunError(null);
    setIsProcessingFiles(false);

    setUploadFiles([]);
    setSubmittedReference("");
    setIsUploadingFiles(false);
    setIsPollingStatus(false);
    setUploadErrorMessage(null);
    setUploadComplete(false);

    setPendingReference(null);
    setShowOverwriteDialog(false);

    completionHandledRef.current = false;
    signatureRef.current = null;
  }, []);

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
    photosRef.current = selectedPhotos;
  }, [selectedPhotos]);

  useEffect(() => {
    return () => {
      revokePhotoPreviewUrls(photosRef.current);
    };
  }, []);

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
      setSelectedPhotos([]);
      setValidationResults([]);
      setUploadFiles([]);
      setUploadComplete(false);
      setUploadErrorMessage(null);
      toast.message(
        "Image selection cleared because class/topic mapping changed",
      );
    }

    signatureRef.current = signature;
  }, [open, expectedPhotoCount, topicOrderIndexes, selectedPhotos]);

  useEffect(() => {
    let cancelled = false;

    if (!open) {
      return;
    }

    if (selectedPhotos.length === 0) {
      setValidationResults([]);
      setValidationRunError(null);
      return;
    }

    const runValidation = async () => {
      try {
        const results = await runAdminPhotoValidation({
          photos: selectedPhotos,
          ruleConfigs,
          marathonStartDate,
          marathonEndDate,
        });

        if (cancelled) {
          return;
        }

        setValidationResults(results);
        setValidationRunError(null);
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : "Failed to validate selected images";

        setValidationRunError(message);
        setValidationResults([]);
      }
    };

    runValidation();

    return () => {
      cancelled = true;
    };
  }, [open, selectedPhotos, ruleConfigs, marathonStartDate, marathonEndDate]);

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

  useEffect(() => {
    const uploadStatus = uploadStatusQuery.data;
    if (!uploadStatus || uploadFiles.length === 0) {
      return;
    }

    let completedAfterUpdate = 0;

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

      completedAfterUpdate = next.filter(
        (file) => file.phase === ADMIN_UPLOAD_PHASE.COMPLETED,
      ).length;

      return next;
    });

    if (uploadStatus.participant?.errors.length) {
      setUploadErrorMessage(uploadStatus.participant.errors.join(", "));
    }

    if (
      uploadStatus.participant?.finalized &&
      completedAfterUpdate === uploadFiles.length &&
      uploadFiles.length > 0
    ) {
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
    uploadFiles.length,
    uploadStatusQuery.data,
    queryClient,
    trpc.participants,
  ]);

  const setField = useCallback(
    <K extends keyof FormState>(name: K, value: FormState[K]) => {
      setFormValues((current) => ({
        ...current,
        [name]: value,
      }));

      setFormErrors((current) => ({
        ...current,
        [name]: undefined,
      }));
    },
    [],
  );

  const validateForm = useCallback(() => {
    const nextErrors: FormErrors = {};

    const normalizedReference = formValues.reference.trim();
    if (!/^\d{1,4}$/.test(normalizedReference)) {
      nextErrors.reference = "Participant reference must be 1-4 digits";
    }

    if (!formValues.firstName.trim()) {
      nextErrors.firstName = "First name is required";
    }

    if (!formValues.lastName.trim()) {
      nextErrors.lastName = "Last name is required";
    }

    if (!EMAIL_REGEX.test(formValues.email.trim())) {
      nextErrors.email = "Enter a valid email address";
    }

    if (marathonMode === "by-camera") {
      if (!formValues.phone.trim()) {
        nextErrors.phone = "Phone number is required in by-camera mode";
      } else if (!isPossiblePhoneNumber(formValues.phone)) {
        nextErrors.phone = "Enter a valid phone number";
      }
    }

    if (!formValues.deviceGroupId) {
      nextErrors.deviceGroupId = "Select a device group";
    }

    if (marathonMode === "marathon" && !formValues.competitionClassId) {
      nextErrors.competitionClassId = "Select a competition class";
    }

    if (expectedPhotoCount === 0) {
      nextErrors.files =
        marathonMode === "marathon"
          ? "Select a competition class before adding images"
          : "No active topic available for by-camera upload";
    } else if (selectedPhotos.length !== expectedPhotoCount) {
      nextErrors.files = `Select exactly ${pluralizePhotos(expectedPhotoCount)}`;
    } else if (validationRunError) {
      nextErrors.files =
        "Validation failed. Please reselect files and try again";
    } else if (hasBlockingValidationErrors(validationResults)) {
      nextErrors.files = "Resolve blocking validation errors before uploading";
    }

    setFormErrors(nextErrors);

    return {
      isValid: Object.keys(nextErrors).length === 0,
      reference: normalizedReference.padStart(4, "0"),
    };
  }, [
    expectedPhotoCount,
    formValues,
    marathonMode,
    selectedPhotos.length,
    validationResults,
    validationRunError,
  ]);

  const runUpload = useCallback(
    async (reference: string) => {
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
          phoneNumber: formValues.phone.trim() ? formValues.phone.trim() : null,
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
    },
    [
      domain,
      formValues.competitionClassId,
      formValues.deviceGroupId,
      formValues.email,
      formValues.firstName,
      formValues.lastName,
      formValues.phone,
      initializeByCameraUploadMutation,
      initializeUploadFlowMutation,
      marathonMode,
      selectedPhotos,
      updateUploadFileState,
    ],
  );

  const handleSubmit = useCallback(async () => {
    if (isBusy || uploadComplete) {
      return;
    }

    const { isValid, reference } = validateForm();
    if (!isValid) {
      return;
    }

    try {
      const exists = await checkParticipantExistsMutation.mutateAsync({
        domain,
        reference,
      });

      if (exists) {
        setPendingReference(reference);
        setShowOverwriteDialog(true);
        return;
      }

      await runUpload(reference);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to check participant reference";
      toast.error(message);
    }
  }, [
    checkParticipantExistsMutation,
    domain,
    isBusy,
    runUpload,
    uploadComplete,
    validateForm,
  ]);

  const handleConfirmOverwrite = useCallback(async () => {
    if (!pendingReference) {
      return;
    }

    setShowOverwriteDialog(false);
    await runUpload(pendingReference);
    setPendingReference(null);
  }, [pendingReference, runUpload]);

  const handleRetryFailed = useCallback(async () => {
    const failedUploads = uploadFiles.filter(
      (file) => file.phase === ADMIN_UPLOAD_PHASE.ERROR,
    );

    if (failedUploads.length === 0 || isBusy) {
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
  }, [isBusy, updateUploadFileState, uploadFiles]);

  const handleFileSelect = useCallback(
    async (fileList: FileList | null) => {
      if (isBusy || uploadComplete) {
        return;
      }

      setIsProcessingFiles(true);
      setUploadComplete(false);
      setUploadErrorMessage(null);
      setUploadFiles([]);
      completionHandledRef.current = false;

      try {
        const result = await processSelectedFiles({
          fileList,
          existingPhotos: selectedPhotos,
          maxPhotos: expectedPhotoCount,
          topicOrderIndexes,
        });

        if (result.errors.length > 0) {
          result.errors.forEach((message) => toast.error(message));
        }

        if (result.warnings.length > 0) {
          result.warnings.forEach((message) => toast.message(message));
        }

        if (result.photos !== selectedPhotos) {
          setSelectedPhotos(result.photos);
          setFormErrors((current) => ({
            ...current,
            files: undefined,
          }));
        }
      } finally {
        setIsProcessingFiles(false);
      }
    },
    [
      expectedPhotoCount,
      isBusy,
      selectedPhotos,
      topicOrderIndexes,
      uploadComplete,
    ],
  );

  const handleChooseFilesClick = useCallback(() => {
    if (isBusy || uploadComplete) {
      return;
    }
    fileInputRef.current?.click();
  }, [isBusy, uploadComplete]);

  const handleRemovePhoto = useCallback(
    (photoId: string) => {
      if (isBusy || uploadComplete) {
        return;
      }

      setUploadFiles([]);
      setUploadComplete(false);
      setUploadErrorMessage(null);
      completionHandledRef.current = false;

      setSelectedPhotos((current) => {
        const target = current.find((photo) => photo.id === photoId);
        if (target) {
          URL.revokeObjectURL(target.previewUrl);
        }

        const remaining = current.filter((photo) => photo.id !== photoId);
        return reassignPhotoOrderIndexes(remaining, topicOrderIndexes);
      });
    },
    [isBusy, topicOrderIndexes, uploadComplete],
  );

  const handleOpenParticipant = useCallback(() => {
    if (!submittedReference) {
      return;
    }

    const targetHref = formatDomainPathname(
      `/admin/dashboard/submissions/${submittedReference}`,
      domain,
    );

    handleDialogOpenChange(false);
    router.push(targetHref);
  }, [domain, handleDialogOpenChange, router, submittedReference]);

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
                <section className="rounded-xl border border-[#e2e2d8] bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-gothic text-lg text-[#1f1f1f]">
                      Participant Details
                    </h3>
                    <Badge
                      variant="outline"
                      className="border-[#deded4] text-[#717169]"
                    >
                      Required
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-[#66665f]">
                        Reference
                      </label>
                      <Input
                        value={formValues.reference}
                        onChange={(event) => {
                          const value = event.target.value
                            .replace(/\D/g, "")
                            .slice(0, 4);
                          setField("reference", value);
                        }}
                        onBlur={() => {
                          if (formValues.reference.length > 0) {
                            setField(
                              "reference",
                              formValues.reference.padStart(4, "0"),
                            );
                          }
                        }}
                        placeholder="0001"
                        inputMode="numeric"
                        maxLength={4}
                        className={cn(
                          "font-mono tracking-[0.2em]",
                          formErrors.reference &&
                            "border-rose-400 focus-visible:ring-rose-400",
                        )}
                      />
                      {formErrors.reference && (
                        <p className="text-xs text-rose-600">
                          {formErrors.reference}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-[#66665f]">
                        Device Group
                      </label>
                      <Select
                        value={formValues.deviceGroupId}
                        onValueChange={(value) =>
                          setField("deviceGroupId", value)
                        }
                        disabled={isBusy}
                      >
                        <SelectTrigger
                          className={cn(
                            formErrors.deviceGroupId &&
                              "border-rose-400 focus-visible:ring-rose-400",
                          )}
                        >
                          <SelectValue placeholder="Select device group" />
                        </SelectTrigger>
                        <SelectContent>
                          {deviceGroups.map((group) => (
                            <SelectItem
                              key={group.id}
                              value={group.id.toString()}
                            >
                              {group.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {formErrors.deviceGroupId && (
                        <p className="text-xs text-rose-600">
                          {formErrors.deviceGroupId}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-[#66665f]">
                        First Name
                      </label>
                      <Input
                        value={formValues.firstName}
                        onChange={(event) =>
                          setField("firstName", event.target.value)
                        }
                        placeholder="James"
                        className={cn(
                          formErrors.firstName &&
                            "border-rose-400 focus-visible:ring-rose-400",
                        )}
                      />
                      {formErrors.firstName && (
                        <p className="text-xs text-rose-600">
                          {formErrors.firstName}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-[#66665f]">
                        Last Name
                      </label>
                      <Input
                        value={formValues.lastName}
                        onChange={(event) =>
                          setField("lastName", event.target.value)
                        }
                        placeholder="Bond"
                        className={cn(
                          formErrors.lastName &&
                            "border-rose-400 focus-visible:ring-rose-400",
                        )}
                      />
                      {formErrors.lastName && (
                        <p className="text-xs text-rose-600">
                          {formErrors.lastName}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-[#66665f]">
                        Email
                      </label>
                      <Input
                        value={formValues.email}
                        onChange={(event) =>
                          setField("email", event.target.value)
                        }
                        placeholder="participant@example.com"
                        className={cn(
                          formErrors.email &&
                            "border-rose-400 focus-visible:ring-rose-400",
                        )}
                      />
                      {formErrors.email && (
                        <p className="text-xs text-rose-600">
                          {formErrors.email}
                        </p>
                      )}
                    </div>

                    {marathonMode === "by-camera" && (
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-semibold uppercase tracking-wide text-[#66665f]">
                          Phone Number
                        </label>
                        <PhoneInput
                          value={formValues.phone}
                          onChange={(value) => setField("phone", value || "")}
                          defaultCountry="SE"
                          className={cn(
                            formErrors.phone &&
                              "[&_input]:border-rose-400 [&_input]:focus-visible:ring-rose-400",
                          )}
                        />
                        {formErrors.phone && (
                          <p className="text-xs text-rose-600">
                            {formErrors.phone}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </section>

                <section className="rounded-xl border border-[#e2e2d8] bg-white p-5 shadow-sm">
                  <h3 className="font-gothic text-lg text-[#1f1f1f]">
                    Upload Mapping
                  </h3>
                  <p className="mt-1 text-sm text-[#66665f]">
                    Files are sorted by EXIF timestamp before being mapped to
                    topic order.
                  </p>

                  <div className="mt-4 space-y-4">
                    {marathonMode === "marathon" && (
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wide text-[#66665f]">
                          Competition Class
                        </label>
                        <Select
                          value={formValues.competitionClassId}
                          onValueChange={(value) =>
                            setField("competitionClassId", value)
                          }
                          disabled={isBusy}
                        >
                          <SelectTrigger
                            className={cn(
                              formErrors.competitionClassId &&
                                "border-rose-400 focus-visible:ring-rose-400",
                            )}
                          >
                            <SelectValue placeholder="Select class" />
                          </SelectTrigger>
                          <SelectContent>
                            {competitionClasses.map((competitionClass) => (
                              <SelectItem
                                key={competitionClass.id}
                                value={competitionClass.id.toString()}
                              >
                                {competitionClass.name} (
                                {pluralizePhotos(
                                  competitionClass.numberOfPhotos,
                                )}
                                )
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {formErrors.competitionClassId && (
                          <p className="text-xs text-rose-600">
                            {formErrors.competitionClassId}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="rounded-lg border border-dashed border-[#d7d7cd] bg-[#fafaf6] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-[#292922]">
                            Required: {pluralizePhotos(expectedPhotoCount)}
                          </p>
                          <p className="text-xs text-[#6a6a63]">
                            Current selection:{" "}
                            {pluralizePhotos(selectedPhotos.length)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleChooseFilesClick}
                          disabled={isBusy || uploadComplete}
                        >
                          {isProcessingFiles ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Camera className="mr-2 h-4 w-4" />
                          )}
                          Select Images
                        </Button>
                      </div>

                      <p className="mt-3 text-xs text-[#6a6a63]">
                        Accepted types:{" "}
                        {ADMIN_COMMON_IMAGE_EXTENSIONS.join(", ")}
                      </p>
                      {formErrors.files && (
                        <p className="mt-2 text-xs text-rose-600">
                          {formErrors.files}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#66665f]">
                        Topic Mapping
                      </p>
                      {selectedTopics.length === 0 ? (
                        <p className="text-sm text-[#6a6a63]">
                          No topics available for current selection.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {selectedTopics.map((topic) => (
                            <div
                              key={topic.id}
                              className="flex items-center justify-between rounded-md border border-[#e1e1d8] bg-[#fcfcf9] px-3 py-2 text-sm"
                            >
                              <span className="text-[#2f2f28]">
                                #{topic.orderIndex + 1} {topic.name}
                              </span>
                              <span className="text-xs text-[#7a7a71]">
                                orderIndex {topic.orderIndex}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div className="min-h-0 overflow-y-auto border-l border-[#e2e2d8] bg-[#fcfcf8] px-6 py-6">
              <div className="space-y-5">
                <section>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-gothic text-lg text-[#1f1f1f]">
                      Selected Images
                    </h3>
                    <Badge
                      variant="outline"
                      className="border-[#deded4] text-[#66665f]"
                    >
                      {selectedPhotos.length}/{expectedPhotoCount}
                    </Badge>
                  </div>

                  {selectedPhotos.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[#d7d7ce] bg-white px-4 py-6 text-center">
                      <p className="text-sm text-[#6f6f66]">
                        No images selected yet.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedPhotos.map((photo) => (
                        <div
                          key={photo.id}
                          className="rounded-lg border border-[#e3e3d9] bg-white px-3 py-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-[#2b2b24]">
                                {photo.file.name}
                              </p>
                              <p className="mt-1 text-xs text-[#6a6a62]">
                                Topic #{photo.orderIndex + 1} ·{" "}
                                {(photo.file.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-[#77776f] hover:text-rose-600"
                              onClick={() => handleRemovePhoto(photo.id)}
                              disabled={isBusy || uploadComplete}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <Separator />

                <section>
                  <h3 className="font-gothic text-lg text-[#1f1f1f]">
                    Validation
                  </h3>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Badge className="border border-rose-200 bg-rose-50 text-rose-700">
                        {blockingValidationErrors.length} blocking
                      </Badge>
                      <Badge className="border border-amber-200 bg-amber-50 text-amber-700">
                        {warningValidationResults.length} warnings
                      </Badge>
                    </div>
                    {validationRunError && (
                      <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        {validationRunError}
                      </div>
                    )}

                    {validationResults.length === 0 && !validationRunError ? (
                      <p className="text-sm text-[#6d6d64]">
                        Validation results will appear after selecting images.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {validationResults.map((result, index) => {
                          const failed =
                            result.outcome === VALIDATION_OUTCOME.FAILED;
                          return (
                            <div
                              key={`${result.ruleKey}-${result.fileName ?? "general"}-${index}`}
                              className={cn(
                                "rounded-md border px-3 py-2 text-xs",
                                failed
                                  ? result.severity === "error"
                                    ? "border-rose-200 bg-rose-50 text-rose-700"
                                    : "border-amber-200 bg-amber-50 text-amber-700"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700",
                              )}
                            >
                              <p className="font-semibold">
                                {formatRuleKey(result.ruleKey)}
                              </p>
                              <p className="mt-1">{result.message}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </section>

                <Separator />

                <section>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-gothic text-lg text-[#1f1f1f]">
                      Upload Status
                    </h3>
                    <span className="text-xs text-[#66665f]">
                      {uploadProgress.completed}/{uploadProgress.total}
                    </span>
                  </div>

                  {uploadFiles.length === 0 ? (
                    <p className="text-sm text-[#6d6d64]">
                      Upload has not started yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {uploadFiles.map((file) => (
                        <div
                          key={file.key}
                          className="rounded-md border border-[#e1e1d8] bg-white px-3 py-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-medium text-[#2b2b24]">
                              {file.file.name}
                            </p>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs",
                                getUploadPhaseClassName(file.phase),
                              )}
                            >
                              {file.phase === ADMIN_UPLOAD_PHASE.UPLOADING && (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              )}
                              {getUploadPhaseLabel(file.phase)}
                            </Badge>
                          </div>
                          {file.error && (
                            <p className="mt-2 text-xs text-rose-600">
                              {file.error.message}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {uploadErrorMessage && (
                    <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                      {uploadErrorMessage}
                    </div>
                  )}

                  {canRetryFailedUploads && !uploadComplete && (
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-3 w-full"
                      onClick={handleRetryFailed}
                      disabled={isBusy}
                    >
                      {isUploadingFiles ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      Retry Failed Uploads
                    </Button>
                  )}

                  {uploadComplete && (
                    <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4" />
                        <div>
                          <p className="font-semibold">Upload completed</p>
                          <p className="text-xs">
                            Participant #{submittedReference} is ready for
                            review.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t border-[#e2e2d8] bg-[#fbfbf7] px-6 py-4 sm:justify-between">
            {uploadComplete ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDialogOpenChange(false)}
                >
                  Close
                </Button>
                <PrimaryButton type="button" onClick={handleOpenParticipant}>
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
                >
                  Cancel
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleChooseFilesClick}
                    disabled={isBusy}
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    Select Images
                  </Button>
                  <PrimaryButton
                    type="button"
                    onClick={handleSubmit}
                    disabled={isBusy}
                  >
                    {isBusy ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    Create & Upload
                  </PrimaryButton>
                </div>
              </>
            )}
          </DialogFooter>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            accept={ADMIN_COMMON_IMAGE_EXTENSIONS.map(
              (extension) => `.${extension}`,
            ).join(",")}
            onChange={(event) => {
              handleFileSelect(event.target.files);
              event.target.value = "";
            }}
          />
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
