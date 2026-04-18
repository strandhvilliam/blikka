"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import type { CompetitionClass, RuleConfig as DbRuleConfig, Topic } from "@blikka/db"
import { VALIDATION_OUTCOME } from "@blikka/validation"

import { Button } from "@/components/ui/button"
import { PrimaryButton } from "@/components/ui/primary-button"
import { useDomain } from "@/lib/domain-provider"
import { COMMON_IMAGE_EXTENSIONS, resolveSelectedImageContentType } from "@/lib/file-processing"
import { useTRPC } from "@/lib/trpc/client"
import { flowStateClientParamSerializer } from "@/lib/flow-state-params-client"
import { cn, formatDomainPathname } from "@/lib/utils"

import { useFileUpload } from "@/hooks/live/flow/use-file-upload"
import { useLivePhotoValidation } from "@/hooks/live/flow/use-live-photo-validation"
import { useUploadFlowState } from "@/hooks/live/flow/use-upload-flow-state"
import { useSelectFile } from "@/hooks/live/flow/use-select-file"
import {
  hasMissingCapturedAtTimestamp,
  reassignPhotosToTopicOrder,
} from "@/lib/flow/photo-ordering"
import { usePhotoStore } from "@/lib/flow/photo-store"
import { useHeicStore } from "@/lib/flow/heic-store"
import { useStepState } from "@/lib/flow/step-state-context"
import type { PhotoWithPresignedUrl } from "@/lib/flow/types"
import { useUploadStore } from "@/lib/flow/upload-store"
import { FINALIZATION_STATE } from "@/lib/flow/types"
import {
  buildInitializeUploadFlowInputResult,
  getUploadFlowIssueMessageKeys,
} from "@/lib/flow/upload-flow-state"
import { buildUploadExifPayload } from "@/lib/upload-exif"

import { SubmissionList } from "./submission-list"
import { UploadProgress } from "./upload-progress"
import { UploadSection } from "./upload-section"
import { HeicConversionDialog } from "./heic-conversion-dialog"
import { ManualPhotoOrderDialog } from "./manual-photo-order-dialog"
import { ParticipantConfirmationDialog } from "./participant-confirmation-dialog"

export function UploadSubmissionsStep({
  ruleConfigs,
  topics,
  competitionClass,
  validationStartDate,
  validationEndDate,
}: {
  ruleConfigs: DbRuleConfig[]
  topics: Topic[]
  competitionClass: CompetitionClass
  validationStartDate: string
  validationEndDate: string
}) {
  const t = useTranslations("FlowPage.uploadStep")
  const trpc = useTRPC()
  const domain = useDomain()
  const { handlePrevStep } = useStepState()
  const router = useRouter()
  const { uploadFlowState } = useUploadFlowState()

  const initializeStore = usePhotoStore((state) => state.initialize)
  const cleanup = usePhotoStore((state) => state.cleanup)
  const clearPhotos = usePhotoStore((state) => state.clearPhotos)
  const photos = usePhotoStore((state) => state.photos)
  const removePhoto = usePhotoStore((state) => state.removePhoto)
  const reorderPhotos = usePhotoStore((state) => state.reorderPhotos)
  const validationResults = usePhotoStore((state) => state.validationResults)
  const isProcessingFiles = usePhotoStore((state) => state.isProcessingFiles)

  const isUploading = useUploadStore((state) => state.isUploading)
  const setIsUploading = useUploadStore((state) => state.setIsUploading)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const hasRedirectedRef = useRef(false)
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false)
  const [showManualOrderDialog, setShowManualOrderDialog] = useState(false)

  const heicIsConverting = useHeicStore((state) => state.isConverting)
  const heicIsCancelling = useHeicStore((state) => state.isCancelling)
  const heicProgress = useHeicStore((state) => state.progress)
  const heicCurrentFileName = useHeicStore((state) => state.currentFileName)
  const cancelHeicConversion = useHeicStore((state) => state.cancel)

  const { handleFileSelect } = useSelectFile({
    maxPhotos: competitionClass.numberOfPhotos,
    t,
  })

  useLivePhotoValidation({
    ruleConfigs,
    validationStartDate,
    validationEndDate,
    marathonMode: "marathon",
  })

  const {
    files: uploadFiles,
    minimumProgressDisplayReached,
    finalizationState,
    participantReference,
    executeUpload,
    retryFailedFiles,
    clearFiles,
  } = useFileUpload()

  useEffect(() => {
    return () => {
      if (hasRedirectedRef.current) {
        clearFiles()
      }
    }
  }, [clearFiles])

  const shouldNavigate =
    finalizationState === FINALIZATION_STATE.READY ||
    finalizationState === FINALIZATION_STATE.TIMEOUT_BLOCKED

  useEffect(() => {
    if (!shouldNavigate || !minimumProgressDisplayReached || hasRedirectedRef.current || !domain) {
      return
    }

    hasRedirectedRef.current = true
    const serializedParams = flowStateClientParamSerializer(uploadFlowState)
    router.push(formatDomainPathname(`/live/verification${serializedParams}`, domain))
  }, [domain, shouldNavigate, minimumProgressDisplayReached, router, uploadFlowState])

  const handleResetAndGoBack = () => {
    const confirmed = window.confirm(t("confirmGoBack"))
    if (!confirmed) return

    clearPhotos()
    clearFiles()
    setIsUploading(false)
    setShowManualOrderDialog(false)
    setShowConfirmationDialog(false)
    handlePrevStep()
  }

  const { mutateAsync: initializeUploadFlow } = useMutation(
    trpc.uploadFlow.initializeUploadFlow.mutationOptions({
      onError: (error) => {
        toast.error(error.message || t("initializationFailed"))
      },
    }),
  )

  const topicOrderIndexes = useMemo(() => topics.map((topic) => topic.orderIndex), [topics])

  useEffect(() => {
    initializeStore({ topicOrderIndexes })
    return () => {
      cleanup()
    }
  }, [initializeStore, cleanup, topicOrderIndexes])

  const handleUploadClick = () => {
    if (isProcessingFiles) return
    if (photos.length >= competitionClass.numberOfPhotos) {
      toast.error(t("maxPhotosReached"))
      return
    }
    fileInputRef.current?.click()
  }

  const handleSubmit = () => {
    if (photos.length !== competitionClass.numberOfPhotos) {
      toast.error(t("selectAllPhotos", { count: competitionClass.numberOfPhotos }))
      return
    }

    if (hasMissingCapturedAtTimestamp(photos)) {
      setShowManualOrderDialog(true)
      return
    }

    setShowConfirmationDialog(true)
  }

  const handleManualOrderContinue = (manuallyOrderedPhotos: typeof photos) => {
    const normalizedPhotos = reassignPhotosToTopicOrder(manuallyOrderedPhotos, topicOrderIndexes)

    reorderPhotos(normalizedPhotos)
    setShowManualOrderDialog(false)
    setShowConfirmationDialog(true)
  }

  const handleConfirmedUpload = async () => {
    setShowConfirmationDialog(false)

    const initializeUploadFlowResult = domain
      ? buildInitializeUploadFlowInputResult(domain, uploadFlowState)
      : null

    if (!initializeUploadFlowResult?.ok) {
      const issueLabels = initializeUploadFlowResult
        ? getUploadFlowIssueMessageKeys(initializeUploadFlowResult.issues).map((messageKey) =>
            t(messageKey),
          )
        : []
      toast.error(
        issueLabels.length > 0
          ? t("missingRequiredInfoDetailed", { fields: issueLabels.join(", ") })
          : t("missingRequiredInfo"),
      )
      return
    }

    try {
      setIsUploading(true)

      const photosInTopicOrder = [...photos].sort((a, b) => a.orderIndex - b.orderIndex)

      const presignedUrls = await initializeUploadFlow({
        ...initializeUploadFlowResult.data,
        uploadContentTypes: photosInTopicOrder.map(
          (photo) => resolveSelectedImageContentType(photo.file) ?? "image/jpeg",
        ),
        uploadExif: buildUploadExifPayload(photosInTopicOrder),
      })

      if (!presignedUrls || presignedUrls.length === 0) {
        setIsUploading(false)
        toast.error(t("failedToGetPresignedUrls"))
        return
      }

      const photosWithUrls: PhotoWithPresignedUrl[] = photosInTopicOrder.map((photo, index) => {
        const urlInfo = presignedUrls[index]
        if (!urlInfo) throw new Error(`Missing presigned URL for photo ${index}`)
        return {
          ...photo,
          presignedUrl: urlInfo.url,
          key: urlInfo.key,
          contentType: urlInfo.contentType,
        }
      })

      try {
        await executeUpload(photosWithUrls)
      } catch (error) {
        console.error("Upload execution failed:", error)
        setIsUploading(false)
      }
    } catch (error) {
      console.error("Upload failed:", error)
      setIsUploading(false)
      toast.error(error instanceof Error && error.message ? error.message : t("uploadFailed"))
    }
  }

  const allPhotosSelected = photos.length === competitionClass.numberOfPhotos && photos.length > 0

  const hasValidationErrors = validationResults.some(
    (result) => result.outcome === VALIDATION_OUTCOME.FAILED && result.severity === "error",
  )

  const canSubmit = allPhotosSelected && !hasValidationErrors && !isProcessingFiles

  return (
    <>
      {/* <UploadInstructionsDialog
        open={showUploadInstructionsDialog}
        onUnderstand={() => setShowUploadInstructionsDialog(false)}
      /> */}

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

      <ManualPhotoOrderDialog
        open={showManualOrderDialog}
        photos={photos}
        topics={topics}
        onClose={() => setShowManualOrderDialog(false)}
        onContinue={handleManualOrderContinue}
      />

      <AnimatePresence mode="wait">
        {isUploading ? (
          <motion.div
            key="upload-progress"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mx-auto max-w-md px-4"
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              "mx-auto max-w-md px-4",
              canSubmit && !isUploading && "pb-[calc(7rem+env(safe-area-inset-bottom,0px))]",
            )}
          >
            {/* Header */}
            <div className="mb-8 text-center">
              <h1 className="font-gothic text-3xl font-medium tracking-tight text-foreground">
                {t("title")}
              </h1>
              <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
                {t("description")}
              </p>
            </div>

            {/* Content */}
            <div className="space-y-6">
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
                accept={COMMON_IMAGE_EXTENSIONS.map((ext) => `.${ext}`).join(",")}
                onChange={async (e) => {
                  const target = e.currentTarget
                  await handleFileSelect(target.files)
                  target.value = ""
                }}
                className="hidden"
              />
            </div>

            {/* Back */}
            <div className="mt-6 flex justify-center">
              <Button
                variant="ghost"
                size="lg"
                onClick={handleResetAndGoBack}
                className="w-full rounded-full bg-muted text-foreground hover:bg-muted/80 hover:text-foreground"
              >
                {t("goBack")}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {canSubmit && !isUploading && (
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-white/95 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur-sm"
        >
          <div className="mx-auto max-w-md">
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
  )
}
