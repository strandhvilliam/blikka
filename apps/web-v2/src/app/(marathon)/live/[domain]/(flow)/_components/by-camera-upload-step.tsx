"use client";

import { Button } from "@/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PrimaryButton } from "@/components/ui/primary-button";
import { useDomain } from "@/lib/domain-provider";
import { useTRPC } from "@/lib/trpc/client";
import type { RuleConfig as DbRuleConfig } from "@blikka/db";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useFileUpload } from "../_hooks/use-file-upload";
import { useUploadFlowState } from "../_hooks/use-upload-flow-state";
import { useSelectFile } from "../_hooks/use-select-file";
import { usePhotoStore } from "../_lib/photo-store";
import { useHeicStore } from "../_lib/heic-store";
import { useStepState } from "../_lib/step-state-context";
import { useRouter } from "next/navigation";
import { flowStateClientParamSerializer } from "@/lib/flow-state-params-client";
import { formatDomainPathname } from "@/lib/utils";
import type { PhotoWithPresignedUrl } from "../_lib/types";
import { useUploadStore } from "../_lib/upload-store";
import { UploadProgressDialog } from "./upload-progress-dialog";
import { HeicConversionDialog } from "./heic-conversion-dialog";
import { UploadConfirmationDialog } from "./upload-confirmation-dialog";
import { VALIDATION_OUTCOME } from "@blikka/validation";
import { mapDbRuleConfigsToValidationRules } from "../_lib/utils";
import { COMMON_IMAGE_EXTENSIONS } from "../_lib/constants";
import {
  ArrowRight,
  FileImage,
  Image as ImageIcon,
  Info,
  RotateCcw,
  RotateCwIcon,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { ValidationStatusBadge } from "./validation-status-badge";

const BY_CAMERA_MAX_PHOTOS = 1;

interface ValidationSummary {
  status: "pending" | "passed" | "warning" | "error";
  outcome?: (typeof VALIDATION_OUTCOME)[keyof typeof VALIDATION_OUTCOME];
  severity?: "error" | "warning";
  messages: string[];
}

function getValidationSummary(
  validationResults: Array<{
    outcome: (typeof VALIDATION_OUTCOME)[keyof typeof VALIDATION_OUTCOME];
    severity?: "error" | "warning";
    message: string;
  }>,
): ValidationSummary {
  if (validationResults.length === 0) {
    return { status: "pending", messages: [] };
  }

  const blockingError = validationResults.find(
    (r) => r.outcome === VALIDATION_OUTCOME.FAILED && r.severity === "error",
  );
  if (blockingError) {
    return {
      status: "error",
      outcome: blockingError.outcome,
      severity: "error",
      messages: validationResults
        .filter((r) => r.outcome !== VALIDATION_OUTCOME.PASSED)
        .map((r) => r.message),
    };
  }

  const warning = validationResults.find(
    (r) => r.outcome !== VALIDATION_OUTCOME.PASSED,
  );
  if (warning) {
    return {
      status: "warning",
      outcome: warning.outcome,
      severity: warning.severity ?? "warning",
      messages: validationResults
        .filter((r) => r.outcome !== VALIDATION_OUTCOME.PASSED)
        .map((r) => r.message),
    };
  }

  return {
    status: "passed",
    outcome: VALIDATION_OUTCOME.PASSED,
    messages: [],
  };
}

function getTimeTaken(exif?: Record<string, unknown>): Date | null {
  if (!exif?.DateTimeOriginal) return null;
  try {
    const dateString = String(exif.DateTimeOriginal);
    const date = new Date(dateString);
    if (!Number.isNaN(date.getTime())) return date;
  } catch {
    // ignore
  }
  return null;
}

export function ByCameraUploadStep({
  ruleConfigs,
  marathonStartDate,
  marathonEndDate,
}: {
  ruleConfigs: DbRuleConfig[];
  marathonStartDate: string;
  marathonEndDate: string;
}) {
  const t = useTranslations("FlowPage.uploadStep");
  const trpc = useTRPC();
  const domain = useDomain();
  const { handlePrevStep } = useStepState();
  const router = useRouter();
  const { uploadFlowState } = useUploadFlowState();

  const initializeStore = usePhotoStore((state) => state.initialize);
  const cleanup = usePhotoStore((state) => state.cleanup);
  const clearPhotos = usePhotoStore((state) => state.clearPhotos);
  const photos = usePhotoStore((state) => state.photos);
  const removePhoto = usePhotoStore((state) => state.removePhoto);
  const validationResults = usePhotoStore((state) => state.validationResults);

  const isUploading = useUploadStore((state) => state.isUploading);
  const setIsUploading = useUploadStore((state) => state.setIsUploading);

  const libraryInputRef = useRef<HTMLInputElement>(null);
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const heicIsConverting = useHeicStore((state) => state.isConverting);
  const heicIsCancelling = useHeicStore((state) => state.isCancelling);
  const heicProgress = useHeicStore((state) => state.progress);
  const heicCurrentFileName = useHeicStore((state) => state.currentFileName);
  const cancelHeicConversion = useHeicStore((state) => state.cancel);

  const { handleFileSelect } = useSelectFile({
    maxPhotos: BY_CAMERA_MAX_PHOTOS,
    t,
  });

  const {
    files: uploadFiles,
    executeUpload,
    retryFailedFiles,
    clearFiles,
  } = useFileUpload({
    domain,
    reference: uploadFlowState.participantRef || "",
    onAllCompleted: () => {
      setTimeout(() => {
        toast.success(t("uploadComplete"));
        const serializedParams =
          flowStateClientParamSerializer(uploadFlowState);
        router.push(
          formatDomainPathname(`/live/confirmation${serializedParams}`, domain),
        );
      }, 500);
    },
  });

  const handleResetAndGoBack = () => {
    const confirmed = window.confirm(t("confirmGoBack"));
    if (!confirmed) return;
    clearPhotos();
    clearFiles();
    setIsUploading(false);
    setShowConfirmationDialog(false);
    handlePrevStep();
  };

  const { mutateAsync: initializeByCameraUpload, isPending: isInitializing } =
    useMutation(
      trpc.uploadFlow.initializeByCameraUpload.mutationOptions({
        onError: (error) => {
          toast.error(error.message || t("initializationFailed"));
        },
      }),
    );

  const validationRules = useMemo(
    () => mapDbRuleConfigsToValidationRules(ruleConfigs),
    [ruleConfigs],
  );

  useEffect(() => {
    initializeStore({
      maxPhotos: BY_CAMERA_MAX_PHOTOS,
      validationRules,
      marathonStartDate: marathonStartDate,
      marathonEndDate: marathonEndDate,
      topicOrderIndexes: [0],
    });

    return () => {
      cleanup();
    };
  }, [
    initializeStore,
    cleanup,
    validationRules,
    marathonStartDate,
    marathonEndDate,
  ]);

  const handleSelectFiles = async (files: FileList | null) => {
    const replace = photos.length > 0;
    await handleFileSelect(files, replace);
  };

  const handleChooseFromLibraryClick = () => libraryInputRef.current?.click();

  const handleSubmit = () => {
    if (photos.length !== BY_CAMERA_MAX_PHOTOS) {
      toast.error(t("selectPhoto"));
      return;
    }
    setShowConfirmationDialog(true);
  };

  const handleConfirmedUpload = async () => {
    setShowConfirmationDialog(false);

    if (
      !domain ||
      !uploadFlowState.participantRef ||
      !uploadFlowState.participantFirstName ||
      !uploadFlowState.participantLastName ||
      !uploadFlowState.participantEmail
    ) {
      toast.error(t("missingRequiredInfo"));
      return;
    }

    try {
      setIsUploading(true);

      const presignedUrls = await initializeByCameraUpload({
        domain,
        reference: uploadFlowState.participantRef,
        firstname: uploadFlowState.participantFirstName,
        lastname: uploadFlowState.participantLastName,
        email: uploadFlowState.participantEmail,
        deviceGroupId: uploadFlowState.deviceGroupId,
      });

      if (!presignedUrls || presignedUrls.length === 0) {
        setIsUploading(false);
        toast.error(t("failedToGetPresignedUrls"));
        return;
      }

      const photosWithUrls: PhotoWithPresignedUrl[] = photos.map(
        (photo, index) => {
          const urlInfo = presignedUrls[index];
          if (!urlInfo) {
            throw new Error("Missing presigned URL for photo " + index);
          }
          return {
            ...photo,
            presignedUrl: urlInfo.url,
            key: urlInfo.key,
          };
        },
      );

      await executeUpload(photosWithUrls);
    } catch (error) {
      console.error("Upload failed:", error);
      setIsUploading(false);
      toast.error(t("uploadFailed"));
    }
  };

  const handleCloseUploadProgress = () => {
    setIsUploading(false);
    clearFiles();
  };

  const photoSelected = photos.length === BY_CAMERA_MAX_PHOTOS;
  const photo = photos[0];

  const hasValidationErrors = validationResults.some(
    (result) =>
      result.outcome === VALIDATION_OUTCOME.FAILED &&
      result.severity === "error",
  );

  const canSubmit = photoSelected && !hasValidationErrors;

  const takenAt = photo ? getTimeTaken(photo.exif) : null;
  const validationSummary = useMemo(
    () => getValidationSummary(validationResults),
    [validationResults],
  );

  return (
    <>
      <HeicConversionDialog
        open={heicIsConverting}
        isConverting={heicIsConverting}
        isCancelling={heicIsCancelling}
        progress={heicProgress}
        currentFileName={heicCurrentFileName}
        onCancel={cancelHeicConversion}
      />

      <UploadConfirmationDialog
        open={showConfirmationDialog}
        isInitializing={isInitializing}
        participantRef={uploadFlowState.participantRef || ""}
        numberOfPhotos={BY_CAMERA_MAX_PHOTOS}
        onOpenChange={setShowConfirmationDialog}
        onConfirm={handleConfirmedUpload}
      />

      <UploadProgressDialog
        open={isUploading}
        files={uploadFiles}
        topics={[]}
        expectedCount={BY_CAMERA_MAX_PHOTOS}
        onClose={handleCloseUploadProgress}
        onComplete={handleCloseUploadProgress}
        onRetry={retryFailedFiles}
      />

      <div
        className={`max-w-4xl mx-auto space-y-6 ${canSubmit ? "pb-28" : ""}`}
      >
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-rocgrotesk font-bold text-center">
            {t("byCameraTitle")}
          </CardTitle>
          <CardDescription className="text-center">
            {t("byCameraDescription")}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 h-full pt-10">
          <AnimatePresence mode="wait">
            {!photo ? (
              <motion.div
                key="dropzone"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="relative"
              >
                <div
                  className={`relative border-2 border-dashed rounded-2xl p-10 sm:p-12 text-center transition-all duration-300 cursor-pointer ${isDragOver
                      ? "border-primary bg-primary/5 scale-[1.02]"
                      : "border-muted-foreground/25 bg-background hover:border-muted-foreground/50 hover:bg-muted/50"
                    }`}
                  onClick={handleChooseFromLibraryClick}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async (e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    if (e.dataTransfer.files?.length > 0) {
                      await handleSelectFiles(e.dataTransfer.files);
                    }
                  }}
                >
                  <motion.div
                    animate={{
                      scale: isDragOver ? 1.1 : 1,
                      rotate: isDragOver ? [0, -5, 5, 0] : 0,
                    }}
                    transition={{ duration: 0.3 }}
                    className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary/10 mb-6"
                  >
                    {isDragOver ? (
                      <FileImage className="w-12 h-12 text-primary" />
                    ) : (
                      <ImageIcon className="w-12 h-12 text-primary" />
                    )}
                  </motion.div>

                  <div className="space-y-3">
                    <p className="text-xl font-medium text-foreground">
                      {t("selectPhotoPrompt")}
                    </p>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                      {t("clickToSelect")}
                    </p>
                  </div>

                  <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                    <PrimaryButton
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleChooseFromLibraryClick();
                      }}
                      className="rounded-full px-8 py-3 text-base font-semibold whitespace-nowrap"
                    >
                      <ImageIcon className="w-5 h-5 mr-2 shrink-0" />
                      <span className="whitespace-nowrap">
                        {t("chooseFromLibrary")}
                      </span>
                    </PrimaryButton>
                  </div>

                  <p className="mt-4 text-xs text-muted-foreground">
                    {t("supportedFormatsShort", {
                      formats: COMMON_IMAGE_EXTENSIONS.map((ext) =>
                        ext.toUpperCase(),
                      ).join(", "),
                    })}
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="preview"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                <div
                  className={[
                    "rounded-3xl overflow-hidden border bg-background shadow-sm",
                    validationSummary.status === "error" &&
                    "border-destructive/40",
                    validationSummary.status === "warning" &&
                    "border-amber-300/60",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div className="relative">
                    <div className="w-full bg-muted">
                      <img
                        src={photo.preview}
                        alt={t("photoPreview")}
                        className="h-full w-full object-contain min-h-[100px]"
                      />
                    </div>

                    <div className="absolute left-4 top-4 flex items-center gap-2">
                      <div className="rounded-full bg-background/85 backdrop-blur px-2 py-1">
                        <ValidationStatusBadge
                          outcome={validationSummary.outcome}
                          severity={validationSummary.severity}
                        />
                      </div>
                    </div>

                    <div className="absolute right-4 top-4 flex gap-2">
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="rounded-full bg-background/85 backdrop-blur"
                        onClick={() => removePhoto(photo.orderIndex)}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">{t("remove")}</span>
                      </Button>
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium leading-tight">
                          {t("yourPhoto")}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {photo.file.name}
                        </p>
                      </div>
                      {takenAt ? (
                        <div className="shrink-0 text-right">
                          <p className="text-xs text-muted-foreground">
                            {t("taken")}
                          </p>
                          <p className="text-xs font-medium tabular-nums">
                            {format(takenAt, "yyyy-MM-dd HH:mm")}
                          </p>
                        </div>
                      ) : null}
                    </div>

                    {validationSummary.messages.length > 0 ? (
                      <div
                        className={[
                          "rounded-2xl border p-3 text-sm",
                          validationSummary.status === "error" &&
                          "border-destructive/30 bg-destructive/5 text-destructive",
                          validationSummary.status === "warning" &&
                          "border-amber-300/50 bg-amber-50 text-amber-900",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <div className="flex items-start gap-2">
                          <Info className="mt-0.5 h-4 w-4 shrink-0" />
                          <ul className="space-y-1">
                            {validationSummary.messages
                              .slice(0, 3)
                              .map((message) => (
                                <li key={message} className="leading-snug">
                                  {message}
                                </li>
                              ))}
                          </ul>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <input
            ref={libraryInputRef}
            type="file"
            accept={COMMON_IMAGE_EXTENSIONS.map((ext) => `.${ext}`).join(",")}
            onChange={async (e) => {
              const target = e.currentTarget;
              await handleSelectFiles(e.target.files);
              target.value = "";
            }}
            className="hidden"
          />
        </CardContent>

        <CardFooter className="flex flex-col gap-3 items-center justify-center">
          {!photoSelected ? (
            <Button
              variant="ghost"
              size="lg"
              onClick={handleResetAndGoBack}
              className="w-[200px]"
            >
              {t("back")}
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="lg"
              onClick={() => {
                handleChooseFromLibraryClick();
              }}
              className="w-[200px]"
            >
              <RotateCwIcon className="w-3.5 h-3.5" />
              {t("selectAnother")}
            </Button>
          )}
        </CardFooter>
      </div>

      {canSubmit && (
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white/95 backdrop-blur-sm border-t border-border shadow-lg pb-[calc(env(safe-area-inset-bottom)+1rem)]"
        >
          <div className="max-w-4xl mx-auto">
            <PrimaryButton
              onClick={handleSubmit}
              className="w-full rounded-full py-4 text-lg font-semibold"
            >
              {t("uploadAndContinue")}
              <ArrowRight className="ml-2 h-5 w-5" />
            </PrimaryButton>
          </div>
        </motion.div>
      )}
    </>
  );
}
