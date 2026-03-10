"use client"

import { Button } from "@/components/ui/button"
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PrimaryButton } from "@/components/ui/primary-button"
import { useDomain } from "@/lib/domain-provider"
import { useTRPC } from "@/lib/trpc/client"
import type { RuleConfig as DbRuleConfig, Topic } from "@blikka/db"
import { useMutation } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { motion, AnimatePresence } from "motion/react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { useFileUpload } from "../_hooks/use-file-upload"
import { useUploadFlowState } from "../_hooks/use-upload-flow-state"
import { useSelectFile } from "../_hooks/use-select-file"
import { usePhotoStore } from "../_lib/photo-store"
import { useHeicStore } from "../_lib/heic-store"
import { useStepState } from "../_lib/step-state-context"
import { useRouter } from "next/navigation"
import { flowStateClientParamSerializer } from "@/lib/flow-state-params-client"
import { formatDomainPathname } from "@/lib/utils"
import type { PhotoWithPresignedUrl } from "../_lib/types"
import { useUploadStore } from "../_lib/upload-store"
import { UploadProgress } from "./upload-progress"
import { ByCameraUploadInput } from "./by-camera-upload-input"
import { HeicConversionDialog } from "./heic-conversion-dialog"
import { UploadConfirmationDialog } from "./upload-confirmation-dialog"
import { VALIDATION_OUTCOME } from "@blikka/validation"
import { mapRuleConfigsToValidationRules } from "@/lib/validation"
import { ArrowRight } from "lucide-react"

const BY_CAMERA_MAX_PHOTOS = 1

export function ByCameraUploadStep({
  topic,
  ruleConfigs,
  marathonStartDate,
  marathonEndDate,
}: {
  topic?: Topic
  ruleConfigs: DbRuleConfig[]
  marathonStartDate: string
  marathonEndDate: string
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


  const isUploading = useUploadStore((state) => state.isUploading)
  const setIsUploading = useUploadStore((state) => state.setIsUploading)

  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)

  const heicIsConverting = useHeicStore((state) => state.isConverting)
  const heicIsCancelling = useHeicStore((state) => state.isCancelling)
  const heicProgress = useHeicStore((state) => state.progress)
  const heicCurrentFileName = useHeicStore((state) => state.currentFileName)
  const cancelHeicConversion = useHeicStore((state) => state.cancel)

  const { handleFileSelect } = useSelectFile({
    maxPhotos: BY_CAMERA_MAX_PHOTOS,
    t,
  })

  const {
    files: uploadFiles,
    executeUpload,
    retryFailedFiles,
    clearFiles,
  } = useFileUpload({
    domain,
    reference: uploadFlowState.participantRef || "",
    onAllCompleted: () => {
      // setTimeout(() => {
      //   toast.success(t("uploadComplete"));
      // const serializedParams =
      //   flowStateClientParamSerializer(uploadFlowState);
      // router.push(
      //   formatDomainPathname(`/live/confirmation${serializedParams}`, domain),
      // );
      // }, 500);
    },
    activeByCameraOrderIndex: topic?.orderIndex,
  })

  const handleResetAndGoBack = () => {
    const confirmed = window.confirm(t("confirmGoBack"))
    if (!confirmed) return
    clearPhotos()
    clearFiles()
    setIsUploading(false)
    setShowConfirmationDialog(false)
    handlePrevStep()
  }


  const { mutateAsync: initializeByCameraUpload, isPending: isInitializing } =
    useMutation(
      trpc.uploadFlow.initializeByCameraUpload.mutationOptions({
        onError: (error) => {
          toast.error(error.message || t("initializationFailed"))
        },
      }),
    )

  const validationRules = useMemo(
    () => mapRuleConfigsToValidationRules(ruleConfigs),
    [ruleConfigs],
  )

  useEffect(() => {
    initializeStore({
      maxPhotos: BY_CAMERA_MAX_PHOTOS,
      validationRules,
      marathonStartDate: marathonStartDate,
      marathonEndDate: marathonEndDate,
      topicOrderIndexes: [0],
    })

    return () => {
      cleanup()
    }
  }, [
    initializeStore,
    cleanup,
    validationRules,
    marathonStartDate,
    marathonEndDate,
  ])

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

    if (
      !domain ||
      !uploadFlowState.participantFirstName ||
      !uploadFlowState.participantLastName ||
      !uploadFlowState.participantEmail ||
      !uploadFlowState.participantPhone ||
      !uploadFlowState.deviceGroupId
    ) {
      toast.error(t("missingRequiredInfo"))
      return
    }

    try {
      const initialization = await initializeByCameraUpload({
        domain,
        firstname: uploadFlowState.participantFirstName,
        lastname: uploadFlowState.participantLastName,
        email: uploadFlowState.participantEmail,
        deviceGroupId: uploadFlowState.deviceGroupId,
        phoneNumber: uploadFlowState.participantPhone,
        replaceExistingActiveTopicUpload:
          uploadFlowState.replaceExistingActiveTopicUpload ?? undefined,
      })

      if (!initialization || initialization.uploads.length === 0) {
        toast.error(t("failedToGetPresignedUrls"))
        return
      }

      await setUploadFlowState((prev) => ({
        ...prev,
        participantId: initialization.participantId,
        participantRef: initialization.reference,
        replaceExistingActiveTopicUpload: null,
      }))
      setIsUploading(true)

      const photosWithUrls: PhotoWithPresignedUrl[] = photos.map(
        (photo, index) => {
          const urlInfo = initialization.uploads[index]
          if (!urlInfo) {
            throw new Error("Missing presigned URL for photo " + index)
          }
          return {
            ...photo,
            presignedUrl: urlInfo.url,
            key: urlInfo.key,
          }
        },
      )

      await executeUpload(photosWithUrls)
    } catch (error) {
      console.error("Upload failed:", error)
      setIsUploading(false)
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("uploadFailed"),
      )
    }
  }

  const handleCloseUploadProgress = () => {
    setIsNavigating(true)
    const serializedParams = flowStateClientParamSerializer(uploadFlowState)
    router.push(
      formatDomainPathname(`/live/confirmation${serializedParams}`, domain),
    )
  }

  const photoSelected = photos.length === BY_CAMERA_MAX_PHOTOS
  const photo = photos[0]

  const hasValidationRules = validationRules.length > 0
  const hasValidationErrors = validationResults.some(
    (result) =>
      result.outcome === VALIDATION_OUTCOME.FAILED &&
      result.severity === "error",
  )

  const canSubmit = photoSelected && !hasValidationErrors

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
        participantRef={uploadFlowState.participantRef || undefined}
        numberOfPhotos={BY_CAMERA_MAX_PHOTOS}
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
              topics={[]}
              expectedCount={BY_CAMERA_MAX_PHOTOS}
              onComplete={handleCloseUploadProgress}
              onRetry={retryFailedFiles}
              isNavigating={isNavigating}
            />
          </motion.div>
        ) : (
          <motion.div
            key="upload-content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`max-w-4xl mx-auto space-y-6 ${canSubmit ? "pb-28" : ""}`}
          >
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-rocgrotesk font-bold text-center">
                {t("byCameraTitle")}
              </CardTitle>
              <CardDescription className="text-center">
                {t("byCameraDescription")}
              </CardDescription>
              {topic && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-sm text-muted-foreground mb-1">
                    {t("topicLabel")}
                  </p>
                  <p className="text-lg font-rocgrotesk font-medium text-foreground">
                    {topic.name}
                  </p>
                </div>
              )}
            </CardHeader>

            <CardContent className="space-y-4 h-full pt-0">
              <ByCameraUploadInput
                photo={photo || null}
                validationResults={validationResults}
                hasValidationRules={hasValidationRules}
                onFileSelect={handleSelectFiles}
                onRemovePhoto={removePhoto}
                onChooseClick={() => { }}
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
                  variant="secondary"
                  size="lg"
                  className="w-[140px] rounded-full"
                >
                  <span className="whitespace-nowrap">
                    Select another
                  </span>
                </Button>
              )}
            </CardFooter>
          </motion.div>
        )}
      </AnimatePresence>

      {canSubmit && !isUploading && (
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
  )
}
