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
import { COMMON_IMAGE_EXTENSIONS } from "@/lib/file-processing";
import { useTRPC } from "@/lib/trpc/client";
import { flowStateClientParamSerializer } from "@/lib/flow-state-params-client";
import { formatDomainPathname } from "@/lib/utils";
import type {
  CompetitionClass,
  RuleConfig as DbRuleConfig,
  Topic,
} from "@blikka/db";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useFileUpload } from "../_hooks/use-file-upload";
import { useLivePhotoValidation } from "../_hooks/use-live-photo-validation";
import { useUploadFlowState } from "../_hooks/use-upload-flow-state";
import { useSelectFile } from "../_hooks/use-select-file";
import { usePhotoStore } from "../_lib/photo-store";
import { useHeicStore } from "../_lib/heic-store";
import { useStepState } from "../_lib/step-state-context";
import type { PhotoWithPresignedUrl } from "../_lib/types";
import { useUploadStore } from "../_lib/upload-store";
import { SubmissionList } from "./submission-list";
import { UploadProgress } from "./upload-progress";
import { UploadSection } from "./upload-section";
import { HeicConversionDialog } from "./heic-conversion-dialog";
import { ParticipantConfirmationDialog } from "./participant-confirmation-dialog";
import { VALIDATION_OUTCOME } from "@blikka/validation";
import { FINALIZATION_STATE } from "../_lib/types";
import {
  buildInitializeUploadFlowInputResult,
  getUploadFlowIssueMessageKeys,
} from "../_lib/upload-flow-state";

export function UploadSubmissionsStep({
  ruleConfigs,
  topics,
  competitionClass,
  validationStartDate,
  validationEndDate,
}: {
  ruleConfigs: DbRuleConfig[];
  topics: Topic[];
  competitionClass: CompetitionClass;
  validationStartDate: string;
  validationEndDate: string;
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
  const isProcessingFiles = usePhotoStore((state) => state.isProcessingFiles);

  const isUploading = useUploadStore((state) => state.isUploading);
  const setIsUploading = useUploadStore((state) => state.setIsUploading);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasRedirectedRef = useRef(false);
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);

  const heicIsConverting = useHeicStore((state) => state.isConverting);
  const heicIsCancelling = useHeicStore((state) => state.isCancelling);
  const heicProgress = useHeicStore((state) => state.progress);
  const heicCurrentFileName = useHeicStore((state) => state.currentFileName);
  const cancelHeicConversion = useHeicStore((state) => state.cancel);

  const { handleFileSelect } = useSelectFile({
    maxPhotos: competitionClass.numberOfPhotos,
    t,
  });

  useLivePhotoValidation({
    ruleConfigs,
    validationStartDate,
    validationEndDate,
  });

  const {
    files: uploadFiles,
    minimumProgressDisplayReached,
    finalizationState,
    participantReference,
    executeUpload,
    retryFailedFiles,
    clearFiles,
  } = useFileUpload({
    domain,
    reference: uploadFlowState.participantRef || "",
  });

  useEffect(() => {
    return () => {
      if (hasRedirectedRef.current) {
        clearFiles();
      }
    };
  }, [clearFiles]);

  useEffect(() => {
    if (
      finalizationState !== FINALIZATION_STATE.READY ||
      !minimumProgressDisplayReached ||
      hasRedirectedRef.current ||
      !domain
    ) {
      return;
    }

    hasRedirectedRef.current = true;
    const serializedParams = flowStateClientParamSerializer(uploadFlowState);
    router.push(
      formatDomainPathname(`/live/verification${serializedParams}`, domain),
    );
  }, [
    domain,
    finalizationState,
    minimumProgressDisplayReached,
    router,
    uploadFlowState,
  ]);

  const handleResetAndGoBack = () => {
    const confirmed = window.confirm(t("confirmGoBack"));

    if (!confirmed) {
      return;
    }

    clearPhotos();
    clearFiles();
    setIsUploading(false);
    setShowConfirmationDialog(false);
    handlePrevStep();
  };

  const { mutateAsync: initializeUploadFlow } = useMutation(
    trpc.uploadFlow.initializeUploadFlow.mutationOptions({
      onError: (error) => {
        toast.error(error.message || t("initializationFailed"));
      },
    }),
  );

  const topicOrderIndexes = useMemo(
    () => topics.map((topic) => topic.orderIndex),
    [topics],
  );

  useEffect(() => {
    initializeStore({
      topicOrderIndexes,
    });

    return () => {
      cleanup();
    };
  }, [initializeStore, cleanup, topicOrderIndexes]);

  const handleUploadClick = () => {
    if (isProcessingFiles) {
      return;
    }

    if (photos.length >= competitionClass.numberOfPhotos) {
      toast.error(t("maxPhotosReached"));
      return;
    }
    fileInputRef.current?.click();
  };

  const handleSubmit = () => {
    if (photos.length !== competitionClass.numberOfPhotos) {
      toast.error(
        t("selectAllPhotos", { count: competitionClass.numberOfPhotos }),
      );
      return;
    }
    setShowConfirmationDialog(true);
  };

  const handleConfirmedUpload = async () => {
    setShowConfirmationDialog(false);

    const initializeUploadFlowResult = domain
      ? buildInitializeUploadFlowInputResult(domain, uploadFlowState)
      : null;

    if (!initializeUploadFlowResult?.ok) {
      const issueLabels = initializeUploadFlowResult
        ? getUploadFlowIssueMessageKeys(initializeUploadFlowResult.issues).map(
            (messageKey) => t(messageKey),
          )
        : [];
      toast.error(
        issueLabels.length > 0
          ? t("missingRequiredInfoDetailed", { fields: issueLabels.join(", ") })
          : t("missingRequiredInfo"),
      );
      return;
    }

    try {
      setIsUploading(true);

      const presignedUrls = await initializeUploadFlow(
        initializeUploadFlowResult.data,
      );

      if (!presignedUrls || presignedUrls.length === 0) {
        setIsUploading(false);
        toast.error(t("failedToGetPresignedUrls"));
        return;
      }

      const photosWithUrls: PhotoWithPresignedUrl[] = photos.map(
        (photo, index) => {
          const urlInfo = presignedUrls[index];
          if (!urlInfo) {
            throw new Error(`Missing presigned URL for photo ${index}`);
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

  const allPhotosSelected =
    photos.length === competitionClass.numberOfPhotos && photos.length > 0;

  const hasValidationErrors = validationResults.some(
    (result) =>
      result.outcome === VALIDATION_OUTCOME.FAILED &&
      result.severity === "error",
  );

  const canSubmit =
    allPhotosSelected && !hasValidationErrors && !isProcessingFiles;

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

      <ParticipantConfirmationDialog
        open={showConfirmationDialog}
        onClose={() => setShowConfirmationDialog(false)}
        onConfirm={handleConfirmedUpload}
        expectedParticipantRef={uploadFlowState.participantRef || ""}
      />

      <AnimatePresence mode="wait">
        {isUploading ? (
          <motion.div
            key="upload-progress"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-4xl mx-auto"
          >
            <UploadProgress
              files={uploadFiles}
              topics={topics}
              expectedCount={competitionClass.numberOfPhotos}
              onRetry={retryFailedFiles}
              finalizationState={finalizationState}
              participantReference={participantReference}
            />
          </motion.div>
        ) : (
          <motion.div
            key="upload-content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-4xl mx-auto space-y-6"
          >
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-rocgrotesk font-bold text-center">
                {t("title")}
              </CardTitle>
              <CardDescription className="text-center">
                {t("description")}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <UploadSection
                maxPhotos={competitionClass.numberOfPhotos}
                onUploadClick={handleUploadClick}
                isProcessingFiles={isProcessingFiles}
              />
              <SubmissionList
                topics={topics}
                maxPhotos={competitionClass.numberOfPhotos}
                onUploadClick={handleUploadClick}
                onRemovePhoto={removePhoto}
              />
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={COMMON_IMAGE_EXTENSIONS.map((ext) => `.${ext}`).join(
                  ",",
                )}
                onChange={async (e) => {
                  const target = e.currentTarget;
                  await handleFileSelect(target.files);
                  target.value = "";
                }}
                className="hidden"
              />
            </CardContent>

            <CardFooter className="flex flex-col gap-3 items-center justify-center">
              <Button
                variant="ghost"
                size="lg"
                onClick={handleResetAndGoBack}
                className="w-[200px]"
              >
                {t("back")}
              </Button>
            </CardFooter>
          </motion.div>
        )}
      </AnimatePresence>

      {canSubmit && !isUploading && (
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white/95 backdrop-blur-sm border-t border-border shadow-lg"
        >
          <div className="max-w-4xl mx-auto">
            <PrimaryButton
              onClick={handleSubmit}
              className="w-full rounded-full py-4 text-lg font-semibold"
            >
              {t("finalizeAndSubmit")}
            </PrimaryButton>
          </div>
        </motion.div>
      )}
    </>
  );
}
