"use client";

import { Button } from "@/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PrimaryButton } from "@/components/ui/primary-button";
import { useDomain } from "@/lib/domain-provider";
import { useTRPC } from "@/lib/trpc/client";
import type { CompetitionClass, RuleConfig as DbRuleConfig, Topic } from "@blikka/db";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useHeicConversion } from "../_hooks/use-heic-conversion";
import { useFileUpload } from "../_hooks/use-file-upload";
import { useUploadFlowState } from "../_hooks/use-upload-flow-state";
import { PhotoProvider, usePhotoContext } from "../_lib/photo-context";
import { useStepState } from "../_lib/step-state-context";
import type { PhotoWithPresignedUrl, SelectedPhoto } from "../_lib/types";
import { UploadProvider, useUploadContext } from "../_lib/upload-context";
import { SubmissionList } from "./submission-list";
import { UploadProgressDialog } from "./upload-progress-dialog";
import { UploadSection } from "./upload-section";
import exifr from "exifr";
import {
  VALIDATION_OUTCOME,
  type ValidationRule,
  type RuleKey,
} from "@blikka/validation";

// Common image extensions for file input
const COMMON_IMAGE_EXTENSIONS = [
  "jpg",
  "jpeg",
  "heic",
  "heif",
  "png",
  "gif",
  "webp",
];

// Helper to convert DB rule configs to validation rules
function mapDbRuleConfigsToValidationRules(
  dbRuleConfigs: DbRuleConfig[]
): ValidationRule[] {
  return dbRuleConfigs
    .filter((rule) => rule.enabled)
    .map((rule) => ({
      ruleKey: rule.ruleKey as RuleKey,
      enabled: rule.enabled,
      severity: rule.severity as "error" | "warning",
      // The params need to be wrapped in the rule key
      params: {
        [rule.ruleKey]: rule.params,
      } as ValidationRule["params"],
    }));
}

interface UploadSubmissionsStepProps {
  competitionClass: CompetitionClass;
  topics: Topic[];
  ruleConfigs: DbRuleConfig[];
  marathonStartDate: string;
  marathonEndDate: string;
}

// Inner component that uses the contexts
function UploadSubmissionsStepInner({
  competitionClass,
  topics,
}: Omit<UploadSubmissionsStepProps, "ruleConfigs" | "marathonStartDate" | "marathonEndDate">) {
  const t = useTranslations("FlowPage.uploadStep");
  const trpc = useTRPC();
  const domain = useDomain();
  const { handlePrevStep } = useStepState();
  const { uploadFlowState } = useUploadFlowState();

  const { photos, addPhotos, removePhoto, validationResults } = usePhotoContext();
  const { isUploading, setIsUploading } = useUploadContext();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);

  // HEIC conversion
  const { state: heicState, convertFiles, cancel: cancelHeicConversion } =
    useHeicConversion();

  // File upload hook
  const {
    files: uploadFiles,
    executeUpload,
    retryFailedFiles,
    clearFiles,
  } = useFileUpload({
    domain,
    reference: uploadFlowState.participantRef || "",
    onAllCompleted: () => {
      // Navigate to verification after a short delay
      setTimeout(() => {
        // TODO: Navigate to verification page
        toast.success(t("uploadComplete"));
      }, 500);
    },
  });

  // Initialize upload flow mutation
  const { mutateAsync: initializeUploadFlow, isPending: isInitializing } =
    useMutation(
      trpc.uploadFlow.initializeUploadFlow.mutationOptions({
        onError: (error) => {
          toast.error(error.message || t("initializationFailed"));
        },
      }),
    );

  // Parse EXIF data from file
  const parseExifData = useCallback(
    async (file: File): Promise<Record<string, unknown> | null> => {
      try {
        const tags = await exifr.parse(file);
        return tags as Record<string, unknown>;
      } catch {
        return null;
      }
    },
    [],
  );

  // Handle file selection
  const handleFileSelect = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) {
        toast.error(t("noFilesSelected"));
        return;
      }

      let files = Array.from(fileList);

      // Check for HEIC files and convert
      const { converted, nonHeic } = await convertFiles(files, parseExifData);

      if (heicState.isCancelling) {
        toast.message(t("conversionCancelled"));
        return;
      }

      // Combine converted and non-HEIC files
      const allFiles = [
        ...nonHeic,
        ...converted.map((c) => c.file),
      ];

      if (allFiles.length === 0) {
        toast.error(t("noValidFiles"));
        return;
      }

      // Check for duplicates
      const existingNames = new Set(photos.map((p) => p.file.name));
      const duplicates = allFiles.filter((f) => existingNames.has(f.name));
      if (duplicates.length > 0) {
        toast.warning(
          t("duplicatesSkipped", { names: duplicates.map((f) => f.name).join(", ") }),
        );
      }

      const uniqueFiles = allFiles.filter((f) => !existingNames.has(f.name));
      const remainingSlots = competitionClass.numberOfPhotos - photos.length;

      if (uniqueFiles.length > remainingSlots) {
        toast.warning(
          t("tooManyFiles", { max: remainingSlots }),
        );
      }

      // Create selected photos with EXIF and previews
      const newPhotos: SelectedPhoto[] = await Promise.all(
        uniqueFiles.slice(0, remainingSlots).map(async (file, index) => {
          const convertedInfo = converted.find((c) => c.file.name === file.name);
          const exif = convertedInfo?.preconvertedExif || await parseExifData(file) || {};

          return {
            file,
            exif,
            preconvertedExif: convertedInfo?.preconvertedExif || null,
            preview: URL.createObjectURL(file),
            orderIndex: photos.length + index,
          };
        }),
      );

      addPhotos(newPhotos);
    },
    [
      photos,
      competitionClass.numberOfPhotos,
      convertFiles,
      parseExifData,
      addPhotos,
      heicState.isCancelling,
      t,
    ],
  );

  // Handle upload button click
  const handleUploadClick = useCallback(() => {
    if (photos.length >= competitionClass.numberOfPhotos) {
      toast.error(t("maxPhotosReached"));
      return;
    }
    fileInputRef.current?.click();
  }, [photos.length, competitionClass.numberOfPhotos, t]);

  // Handle submit
  const handleSubmit = useCallback(() => {
    if (photos.length !== competitionClass.numberOfPhotos) {
      toast.error(t("selectAllPhotos", { count: competitionClass.numberOfPhotos }));
      return;
    }
    setShowConfirmationDialog(true);
  }, [photos.length, competitionClass.numberOfPhotos, t]);

  // Handle confirmed upload
  const handleConfirmedUpload = useCallback(async () => {
    setShowConfirmationDialog(false);

    if (
      !domain ||
      !uploadFlowState.participantRef ||
      !uploadFlowState.competitionClassId ||
      !uploadFlowState.deviceGroupId ||
      !uploadFlowState.participantFirstName ||
      !uploadFlowState.participantLastName ||
      !uploadFlowState.participantEmail
    ) {
      toast.error(t("missingRequiredInfo"));
      return;
    }

    try {
      setIsUploading(true);

      // Initialize upload flow and get presigned URLs
      const presignedUrls = await initializeUploadFlow({
        domain,
        reference: uploadFlowState.participantRef,
        firstname: uploadFlowState.participantFirstName,
        lastname: uploadFlowState.participantLastName,
        email: uploadFlowState.participantEmail,
        competitionClassId: uploadFlowState.competitionClassId,
        deviceGroupId: uploadFlowState.deviceGroupId,
      });

      if (!presignedUrls || presignedUrls.length === 0) {
        setIsUploading(false);
        toast.error(t("failedToGetPresignedUrls"));
        return;
      }

      // Combine photos with presigned URLs
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

      // Execute upload
      await executeUpload(photosWithUrls);
    } catch (error) {
      console.error("Upload failed:", error);
      setIsUploading(false);
      toast.error(t("uploadFailed"));
    }
  }, [
    domain,
    uploadFlowState,
    photos,
    initializeUploadFlow,
    executeUpload,
    setIsUploading,
    t,
  ]);

  const handleCloseUploadProgress = useCallback(() => {
    setIsUploading(false);
    clearFiles();
  }, [setIsUploading, clearFiles]);

  const allPhotosSelected =
    photos.length === competitionClass.numberOfPhotos && photos.length > 0;

  // Check if there are validation errors (severity: error only)
  const hasValidationErrors = validationResults.some(
    (result) =>
      result.outcome === VALIDATION_OUTCOME.FAILED &&
      result.severity === "error",
  );

  // Show finalize button only when all photos selected and no validation errors
  const canSubmit = allPhotosSelected && !hasValidationErrors;

  return (
    <>
      {/* HEIC conversion dialog */}
      <Dialog open={heicState.isConverting}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-rocgrotesk">{t("convertingHeic")}</DialogTitle>
            <DialogDescription>
              {heicState.isCancelling
                ? t("cancelling")
                : t("conversionProgress", {
                  current: heicState.progress.current,
                  total: heicState.progress.total,
                  fileName: heicState.currentFileName || "",
                })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 py-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <div className="text-sm text-muted-foreground">
              {heicState.isCancelling
                ? t("stoppingConversion")
                : t("convertingFile", {
                  current: heicState.progress.current,
                  total: heicState.progress.total,
                })}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={cancelHeicConversion}
              disabled={heicState.isCancelling}
            >
              {t("cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog */}
      <Dialog
        open={showConfirmationDialog}
        onOpenChange={setShowConfirmationDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmUpload")}</DialogTitle>
            <DialogDescription>
              {t("confirmUploadDescription", {
                ref: uploadFlowState.participantRef || "",
                count: competitionClass.numberOfPhotos,
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmationDialog(false)}
            >
              {t("cancel")}
            </Button>
            <PrimaryButton onClick={handleConfirmedUpload} disabled={isInitializing}>
              {isInitializing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("initializing")}
                </>
              ) : (
                t("confirmAndUpload")
              )}
            </PrimaryButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload progress dialog */}
      <UploadProgressDialog
        open={isUploading}
        files={uploadFiles}
        topics={topics}
        expectedCount={competitionClass.numberOfPhotos}
        onClose={handleCloseUploadProgress}
        onComplete={handleCloseUploadProgress}
        onRetry={retryFailedFiles}
      />

      {/* Main content */}
      <div className="max-w-4xl mx-auto space-y-6">
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
            accept={COMMON_IMAGE_EXTENSIONS.map((ext) => `.${ext}`).join(",")}
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
          />
        </CardContent>

        <CardFooter className="flex flex-col gap-3 items-center justify-center">
          <Button
            variant="ghost"
            size="lg"
            onClick={handlePrevStep}
            className="w-[200px]"
          >
            {t("back")}
          </Button>
        </CardFooter>
      </div>

      {/* Floating finalize button */}
      {canSubmit && (
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

// Main export with providers
export function UploadSubmissionsStep(props: UploadSubmissionsStepProps) {
  // Convert DB rule configs to validation rules
  const validationRules = useMemo(
    () => mapDbRuleConfigsToValidationRules(props.ruleConfigs),
    [props.ruleConfigs]
  );

  // Get topic order indexes
  const topicOrderIndexes = useMemo(
    () => props.topics.map((topic) => topic.orderIndex),
    [props.topics]
  );

  return (
    <PhotoProvider
      maxPhotos={props.competitionClass.numberOfPhotos}
      validationRules={validationRules}
      marathonStartDate={props.marathonStartDate}
      marathonEndDate={props.marathonEndDate}
      topicOrderIndexes={topicOrderIndexes}
    >
      <UploadProvider>
        <UploadSubmissionsStepInner
          competitionClass={props.competitionClass}
          topics={props.topics}
        />
      </UploadProvider>
    </PhotoProvider>
  );
}
