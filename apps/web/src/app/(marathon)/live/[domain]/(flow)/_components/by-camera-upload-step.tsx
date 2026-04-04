"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { ArrowRight } from "lucide-react"
import type { RuleConfig as DbRuleConfig, Topic } from "@blikka/db"
import { VALIDATION_OUTCOME } from "@blikka/validation"

import { Button } from "@/components/ui/button"
import { PrimaryButton } from "@/components/ui/primary-button"
import { useDomain } from "@/lib/domain-provider"
import { useTRPC } from "@/lib/trpc/client"
import { flowStateClientParamSerializer } from "@/lib/flow-state-params-client"
import { formatDomainPathname } from "@/lib/utils"
import { mapRuleConfigsToValidationRules } from "@/lib/validation"

import { useFileUpload } from "../_hooks/use-file-upload"
import { useLivePhotoValidation } from "../_hooks/use-live-photo-validation"
import { useUploadFlowState } from "../_hooks/use-upload-flow-state"
import { useSelectFile } from "../_hooks/use-select-file"
import { usePhotoStore } from "../_lib/photo-store"
import { useHeicStore } from "../_lib/heic-store"
import { useStepState } from "../_lib/step-state-context"
import type { PhotoWithPresignedUrl } from "../_lib/types"
import { useUploadStore } from "../_lib/upload-store"
import { FINALIZATION_STATE } from "../_lib/types"
import {
  buildInitializeByCameraUploadInputResult,
  getUploadFlowIssueMessageKeys,
} from "../_lib/upload-flow-state"

import { UploadProgress } from "./upload-progress"
import { ByCameraUploadInput } from "./by-camera-upload-input"
import { HeicConversionDialog } from "./heic-conversion-dialog"
import { UploadConfirmationDialog } from "./upload-confirmation-dialog"

const BY_CAMERA_MAX_PHOTOS = 1

export function ByCameraUploadStep({
  topic,
  ruleConfigs,
  validationStartDate,
  validationEndDate,
}: {
  topic?: Topic
  ruleConfigs: DbRuleConfig[]
  validationStartDate?: string | null
  validationEndDate?: string | null
}) {
  const t = useTranslations("FlowPage.uploadStep")
  const trpc = useTRPC()
  const domain = useDomain()
  const { handlePrevStep } = useStepState()
  const router = useRouter()
  const { uploadFlowState, setUploadFlowState } = useUploadFlowState()

  const initializeStore = usePhotoStore((state) => state.initialize)
  const cleanup = usePhotoStore((state) => state.cleanup)
  const clearPhotos = usePhotoStore((state) => state.clearPhotos)
  const photos = usePhotoStore((state) => state.photos)
  const removePhoto = usePhotoStore((state) => state.removePhoto)
  const validationResults = usePhotoStore((state) => state.validationResults)
  const isProcessingFiles = usePhotoStore((state) => state.isProcessingFiles)

  const isUploading = useUploadStore((state) => state.isUploading)
  const setIsUploading = useUploadStore((state) => state.setIsUploading)

  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false)
  const hasRedirectedRef = useRef(false)
  const selectAnotherFileInputRef = useRef<HTMLInputElement>(null)

  const heicIsConverting = useHeicStore((state) => state.isConverting)
  const heicIsCancelling = useHeicStore((state) => state.isCancelling)
  const heicProgress = useHeicStore((state) => state.progress)
  const heicCurrentFileName = useHeicStore((state) => state.currentFileName)
  const cancelHeicConversion = useHeicStore((state) => state.cancel)

  const { handleFileSelect } = useSelectFile({
    maxPhotos: BY_CAMERA_MAX_PHOTOS,
    t,
  })

  useLivePhotoValidation({
    ruleConfigs,
    validationStartDate,
    validationEndDate,
    marathonMode: "by-camera",
  })

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
  })

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
    router.push(formatDomainPathname(`/live/confirmation${serializedParams}`, domain))
  }, [domain, shouldNavigate, minimumProgressDisplayReached, router, uploadFlowState])

  const handleResetAndGoBack = () => {
    const confirmed = window.confirm(t("confirmGoBack"))
    if (!confirmed) return
    clearPhotos()
    clearFiles()
    setIsUploading(false)
    setShowConfirmationDialog(false)
    handlePrevStep()
  }

  const { mutateAsync: initializeByCameraUpload, isPending: isInitializing } = useMutation(
    trpc.uploadFlow.initializeByCameraUpload.mutationOptions({
      onError: (error) => {
        toast.error(error.message || t("initializationFailed"))
      },
    }),
  )

  const validationRules = useMemo(
    () => mapRuleConfigsToValidationRules(ruleConfigs, "by-camera"),
    [ruleConfigs],
  )

  useEffect(() => {
    initializeStore({ topicOrderIndexes: [0] })
    return () => {
      cleanup()
    }
  }, [initializeStore, cleanup])

  const handleSelectFiles = async (files: FileList | null) => {
    const replace = photos.length > 0
    await handleFileSelect(files, replace)
  }

  const handleSubmit = () => {
    if (photos.length !== BY_CAMERA_MAX_PHOTOS) {
      toast.error(t("selectPhoto"))
      return
    }
    setShowConfirmationDialog(true)
  }

  const handleConfirmedUpload = async () => {
    setShowConfirmationDialog(false)

    const initializeByCameraUploadResult = domain
      ? buildInitializeByCameraUploadInputResult(domain, uploadFlowState)
      : null

    if (!initializeByCameraUploadResult?.ok) {
      const issueLabels = initializeByCameraUploadResult
        ? getUploadFlowIssueMessageKeys(initializeByCameraUploadResult.issues).map((messageKey) =>
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

      const initialization = await initializeByCameraUpload(initializeByCameraUploadResult.data)

      if (!initialization || initialization.uploads.length === 0) {
        setIsUploading(false)
        toast.error(t("failedToGetPresignedUrls"))
        return
      }

      await setUploadFlowState((prev) => ({
        ...prev,
        participantId: initialization.participantId,
        participantRef: initialization.reference,
        replaceExistingActiveTopicUpload: null,
      }))

      const photosWithUrls: PhotoWithPresignedUrl[] = photos.map((photo, index) => {
        const urlInfo = initialization.uploads[index]
        if (!urlInfo) throw new Error("Missing presigned URL for photo " + index)
        return {
          ...photo,
          presignedUrl: urlInfo.url,
          key: urlInfo.key,
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
      toast.error(
        error instanceof Error && error.message ? error.message : t("uploadFailed"),
      )
    }
  }

  const photoSelected = photos.length === BY_CAMERA_MAX_PHOTOS
  const photo = photos[0]

  const hasValidationRules = validationRules.length > 0
  const hasValidationErrors = validationResults.some(
    (result) => result.outcome === VALIDATION_OUTCOME.FAILED && result.severity === "error",
  )

  const canSubmit = photoSelected && !hasValidationErrors && !isProcessingFiles

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
        onOpenChange={setShowConfirmationDialog}
        onConfirm={handleConfirmedUpload}
        isInitializing={isInitializing}
        numberOfPhotos={BY_CAMERA_MAX_PHOTOS}
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
              mode="by-camera"
              files={uploadFiles}
              topics={[]}
              expectedCount={BY_CAMERA_MAX_PHOTOS}
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
            className={`mx-auto max-w-md px-4 ${canSubmit ? "pb-28" : ""}`}
          >
            {/* Header */}
            <div className="mb-8 text-center">
              <h1 className="font-gothic text-3xl font-medium tracking-tight text-foreground">
                {t("byCameraTitle")}
              </h1>
              <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
                {t("byCameraDescription")}
              </p>
              {topic && (
                <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-muted/30 px-4 py-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                    {t("topicLabel")}
                  </span>
                  <span className="text-sm font-semibold text-foreground">{topic.name}</span>
                </div>
              )}
            </div>

            {/* Upload input */}
            <div className="space-y-4">
              <ByCameraUploadInput
                photo={photo || null}
                validationResults={validationResults}
                hasValidationRules={hasValidationRules}
                isProcessing={isProcessingFiles}
                fileInputRef={selectAnotherFileInputRef}
                onFileSelect={handleSelectFiles}
                onRemovePhoto={removePhoto}
              />
            </div>

            {/* Actions */}
            <div className="mt-6 flex justify-center">
              {!photoSelected ? (
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={handleResetAndGoBack}
                  className="w-full"
                >
                  {t("back")}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="lg"
                  className="rounded-full px-6"
                  disabled={isProcessingFiles}
                  onClick={() => selectAnotherFileInputRef.current?.click()}
                >
                  <span className="whitespace-nowrap">{t("selectAnother")}</span>
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {canSubmit && !isUploading && (
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-white/95 p-4 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur-sm pb-[calc(env(safe-area-inset-bottom)+1rem)]"
        >
          <div className="mx-auto max-w-md">
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
  )
}
