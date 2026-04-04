"use client"

import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { ArrowLeft, ArrowRight, Loader2, UploadIcon } from "lucide-react"
import dynamic from "next/dynamic"
import { toast } from "sonner"
import { motion } from "motion/react"

import { useDomain } from "@/lib/domain-provider"
import { useTRPC } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import { getExpectedPhotoCount } from "@/lib/upload-utils"
import type { UploadMarathonMode } from "@/lib/types"
import {
  resolveStaffLaptopUploadLookupOutcome,
  type ParticipantExistenceStatus,
} from "@/lib/flow-helpers"
import {
  PARTICIPANT_UPLOAD_PHASE,
  type ParticipantPreparedUpload,
  type ParticipantSelectedPhoto,
  type ParticipantUploadFileState,
} from "@/lib/participant-upload-types"
import { uploadManualFiles } from "@/lib/manual-upload"
import { Button } from "@/components/ui/button"
import { PrimaryButton } from "@/components/ui/primary-button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { getByCameraSubmissionWindowState } from "@/lib/by-camera/by-camera-submission-window-state"
import { normalizeParticipantReference } from "../../_lib/staff-utils"
import type { StaffParticipant } from "../../_lib/staff-types"
import { useStaffUploadParticipantSummary } from "../_hooks/use-staff-upload-participant-summary"
import { useStaffUploadStep } from "../_hooks/use-staff-upload-step"
import { useStaffPhotoValidation } from "../_hooks/use-staff-photo-validation"
import { useStaffUploadStatusSync } from "../_hooks/use-staff-upload-status-sync"
import { validateStaffUploadFiles, validateStaffUploadForm } from "../_lib/staff-upload-form"
import { useStaffUploadStore, selectRequiresOverwriteWarning } from "../_lib/staff-upload-store"
import { ParticipantDetailsStep } from "./participant-details-step"
import { PhoneLookupStep } from "./phone-lookup-step"
import { ReferenceStep } from "./reference-step"
import { UploadCompletePanel } from "./upload-complete-panel"
import { UploadProgressPanel } from "./upload-progress-panel"
import { UploadStep } from "./upload-step"

const POLLING_INTERVAL_MS = 3000

const StepIndicator = dynamic(
  () => import("./step-indicator").then((m) => ({ default: m.StepIndicator })),
  {
    ssr: false,
    loading: () => (
      <nav className="flex flex-col items-center gap-1" aria-label="Progress">
        <div className="flex h-7 w-full min-w-[200px] max-w-[280px] items-center justify-center opacity-50">
          <div className="h-1.5 w-full max-w-[240px] rounded-full bg-muted" />
        </div>
      </nav>
    ),
  },
)

interface StaffLaptopUploadClientProps {
  staffEmail?: string | null
  staffImage?: string | null
  staffName?: string | null
}

function getStaffInitials(name?: string | null, email?: string | null) {
  const source = (name || email || "Staff").trim()
  const words = source.split(/\s+/).filter(Boolean)
  if (words.length === 0) return "ST"
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return words
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
}

function getBlockedMessage(status: ParticipantExistenceStatus) {
  if (status === "verified") {
    return "This participant has already been verified and cannot be uploaded again from the staff laptop flow."
  }

  return "This participant has already completed the upload flow and cannot be uploaded again from the staff laptop flow."
}

function formatTopicDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

type ByCameraSubmissionWindowBlockedState = Exclude<
  ReturnType<typeof getByCameraSubmissionWindowState>,
  "open"
>

interface StaffByCameraSubmissionWindowGateProps {
  state: ByCameraSubmissionWindowBlockedState | null
  topicName: string | null
  scheduledStart: string | null
  scheduledEnd: string | null
}

function StaffByCameraSubmissionWindowGate({
  state,
  topicName,
  scheduledStart,
  scheduledEnd,
}: StaffByCameraSubmissionWindowGateProps) {
  let body: string
  if (state === "no-active-topic") {
    body =
      "There is no active topic for this event. Staff cannot upload until a topic is activated in the dashboard."
  } else if (state === "not-opened") {
    body =
      "The submission window for this topic has not been opened yet. Open submissions from the dashboard when you are ready."
  } else if (state === "scheduled" && scheduledStart) {
    body = `Submissions open ${formatTopicDateTime(scheduledStart)}.`
  } else if (state === "scheduled") {
    body = "Submissions are scheduled to open later."
  } else {
    body =
      scheduledEnd != null
        ? `Submissions closed ${formatTopicDateTime(scheduledEnd)}.`
        : "Submissions are closed for this topic."
  }

  return (
    <div className="flex flex-col items-center py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
        Submission window
      </p>
      <h2 className="mt-3 font-gothic text-4xl font-medium leading-none tracking-tight text-foreground">
        Uploads unavailable
      </h2>
      {topicName ? (
        <p className="mt-2 text-sm font-medium text-foreground/80">{topicName}</p>
      ) : null}
      <div className="mt-8 w-full max-w-md rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-900">
        {body}
      </div>
    </div>
  )
}

export function StaffLaptopUploadClient({
  staffEmail,
  staffImage,
  staffName,
}: StaffLaptopUploadClientProps) {
  const domain = useDomain()
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const [step, setStep] = useStaffUploadStep()

  const formValues = useStaffUploadStore((s) => s.formValues)
  const existingParticipant = useStaffUploadStore((s) => s.existingParticipant)
  const showOverwriteDialog = useStaffUploadStore((s) => s.showOverwriteDialog)
  const requiresOverwriteWarning = useStaffUploadStore(selectRequiresOverwriteWarning)
  const byCameraReplaceExistingTopicUpload = useStaffUploadStore(
    (s) => s.byCameraReplaceExistingTopicUpload,
  )
  const byCameraReplaceFinalizedParticipantUpload = useStaffUploadStore(
    (s) => s.byCameraReplaceFinalizedParticipantUpload,
  )

  const resetForm = useStaffUploadStore((s) => s.resetForm)
  const setFormField = useStaffUploadStore((s) => s.setFormField)
  const setFormErrors = useStaffUploadStore((s) => s.setFormErrors)
  const clearFormErrors = useStaffUploadStore((s) => s.clearFormErrors)
  const patchParticipant = useStaffUploadStore((s) => s.patchParticipant)

  const selectedPhotos = useStaffUploadStore((s) => s.selectedPhotos)
  const validationResults = useStaffUploadStore((s) => s.validationResults)
  const validationRunError = useStaffUploadStore((s) => s.validationRunError)

  const resetPhotoSelection = useStaffUploadStore((s) => s.resetPhotoSelection)
  const patchPhotos = useStaffUploadStore((s) => s.patchPhotos)

  const uploadFiles = useStaffUploadStore((s) => s.uploadFiles)
  const submittedReference = useStaffUploadStore((s) => s.submittedReference)
  const isUploadingFiles = useStaffUploadStore((s) => s.isUploadingFiles)
  const isPollingStatus = useStaffUploadStore((s) => s.isPollingStatus)
  const uploadComplete = useStaffUploadStore((s) => s.uploadComplete)

  const updateUploadFileState = useStaffUploadStore((s) => s.updateUploadFileState)
  const resetUploadFlow = useStaffUploadStore((s) => s.resetUploadFlow)
  const patchUpload = useStaffUploadStore((s) => s.patchUpload)

  const resetAllState = useStaffUploadStore((s) => s.resetAllState)

  const { data: marathon } = useSuspenseQuery(trpc.marathons.getByDomain.queryOptions({ domain }))
  const marathonMode = marathon.mode as UploadMarathonMode
  const sortedTopics = marathon.topics.toSorted((a, b) => a.orderIndex - b.orderIndex)
  const activeByCameraTopic = sortedTopics.find((topic) => topic.visibility === "active") ?? null

  const lookupParticipantMutation = useMutation(
    trpc.uploadFlow.checkParticipantExists.mutationOptions(),
  )
  const resolveByCameraParticipantByPhone = useMutation(
    trpc.uploadFlow.resolveByCameraParticipantByPhone.mutationOptions(),
  )
  const initializeUploadFlowMutation = useMutation(
    trpc.uploadFlow.initializeUploadFlow.mutationOptions(),
  )
  const initializeStaffByCameraUploadMutation = useMutation(
    trpc.uploadFlow.initializeStaffByCameraUpload.mutationOptions(),
  )

  const activeCompetitionClassId = existingParticipant
    ? String(existingParticipant.competitionClassId)
    : formValues.competitionClassId
  const activeDeviceGroupId = existingParticipant
    ? String(existingParticipant.deviceGroupId)
    : formValues.deviceGroupId

  const selectedCompetitionClass =
    marathon.competitionClasses.find((cc) => cc.id === Number(activeCompetitionClassId)) ?? null

  const expectedPhotoCount = getExpectedPhotoCount(
    marathonMode,
    activeByCameraTopic,
    selectedCompetitionClass,
  )

  const isMappingReady =
    !!activeDeviceGroupId &&
    (marathonMode === "marathon" ? !!selectedCompetitionClass : !!activeByCameraTopic)

  const participantSummary = useStaffUploadParticipantSummary()

  const uploadStatusQuery = useQuery(
    trpc.uploadFlow.getUploadStatus.queryOptions(
      {
        domain,
        reference: submittedReference,
        orderIndexes: uploadFiles.map((file) => file.orderIndex),
      },
      {
        enabled: isPollingStatus && submittedReference.length > 0 && uploadFiles.length > 0,
        refetchInterval: POLLING_INTERVAL_MS,
        refetchIntervalInBackground: false,
      },
    ),
  )

  const isUploadBusy =
    isUploadingFiles ||
    isPollingStatus ||
    initializeUploadFlowMutation.isPending ||
    initializeStaffByCameraUploadMutation.isPending
  const [byCameraReplaceDialogOpen, setByCameraReplaceDialogOpen] = useState(false)
  const [pendingByCameraReplacement, setPendingByCameraReplacement] = useState<{
    reference: string
    participantId: number
  } | null>(null)
  /** Re-render periodically so scheduled → open transitions without a full page reload. */
  const [, setByCameraSubmissionClock] = useState(0)

  const isBusy =
    lookupParticipantMutation.isPending ||
    isUploadBusy ||
    (marathonMode === "by-camera" && resolveByCameraParticipantByPhone.isPending)
  const canSelectFiles = isMappingReady && expectedPhotoCount > 0
  const isMaxImagesReached = selectedPhotos.length >= expectedPhotoCount && expectedPhotoCount > 0
  const isDropzoneDisabled = !canSelectFiles || isBusy || uploadComplete || isMaxImagesReached

  useEffect(() => {
    resetAllState()
    void setStep(marathonMode === "by-camera" ? "phone" : "reference")

    return () => {
      resetAllState()
    }
  }, [marathonMode, resetAllState, setStep])

  useEffect(() => {
    if (marathonMode !== "by-camera") return
    const id = window.setInterval(() => {
      setByCameraSubmissionClock((c) => c + 1)
    }, 15_000)
    return () => window.clearInterval(id)
  }, [marathonMode])

  const byCameraSubmissionWindowState =
    marathonMode === "by-camera"
      ? getByCameraSubmissionWindowState(activeByCameraTopic, new Date())
      : null

  useEffect(() => {
    if (marathonMode === "marathon" && step === "phone") {
      void setStep("reference")
      return
    }

    if (marathonMode === "by-camera" && step === "reference") {
      void setStep("phone")
      return
    }

    if (step === "phone" || step === "reference") return

    if (step === "details") {
      if (marathonMode === "by-camera" && !formValues.phone.trim()) {
        void setStep("phone")
        return
      }
      if (marathonMode !== "by-camera" && !formValues.reference.trim()) {
        void setStep("reference")
        return
      }
    }

    if ((step === "upload" || step === "progress" || step === "complete") && !participantSummary) {
      if (marathonMode === "by-camera") {
        void setStep(formValues.phone.trim() ? "details" : "phone")
        return
      }
      void setStep(formValues.reference.trim() ? "details" : "reference")
    }
  }, [formValues.phone, formValues.reference, marathonMode, participantSummary, setStep, step])

  useStaffPhotoValidation({
    step,
    ruleConfigs: marathon.ruleConfigs,
    marathonStartDate: marathon.startDate,
    marathonEndDate: marathon.endDate,
    marathonMode,
  })

  const { resetCompletion } = useStaffUploadStatusSync({
    domain,
    uploadStatusData: uploadStatusQuery.data,
    refetchUploadStatus: async () => {
      await uploadStatusQuery.refetch()
    },
    setStep,
  })

  async function runUpload(
    reference: string,
    photos: ParticipantSelectedPhoto[],
    participantDraft?: Partial<typeof formValues>,
    options?: {
      replaceExistingActiveTopicUpload?: boolean
      replaceFinalizedParticipantUpload?: boolean
    },
  ) {
    if (photos.length === 0) return

    const resolvedFormValues = {
      ...formValues,
      ...participantDraft,
      reference,
    }

    patchUpload({
      uploadErrorMessage: null,
      uploadComplete: false,
      isUploadingFiles: true,
      isPollingStatus: false,
    })
    resetCompletion()

    try {
      const commonPayload = {
        domain,
        firstname: resolvedFormValues.firstName.trim(),
        lastname: resolvedFormValues.lastName.trim(),
        email: resolvedFormValues.email.trim(),
        deviceGroupId: Number(resolvedFormValues.deviceGroupId),
        phoneNumber: resolvedFormValues.phone.trim(),
      }

      const orderedPhotos = [...photos].sort((a, b) => a.orderIndex - b.orderIndex)

      const initialization =
        marathonMode === "marathon"
          ? await initializeUploadFlowMutation.mutateAsync({
              ...commonPayload,
              reference,
              phoneNumber: commonPayload.phoneNumber || null,
              competitionClassId: Number(resolvedFormValues.competitionClassId),
              uploadContentTypes: orderedPhotos.map((photo) => photo.file.type || "image/jpeg"),
            })
          : await initializeStaffByCameraUploadMutation.mutateAsync({
              domain,
              reference: reference.trim() ? reference : "",
              firstname: commonPayload.firstname,
              lastname: commonPayload.lastname,
              email: commonPayload.email,
              deviceGroupId: commonPayload.deviceGroupId,
              phoneNumber: commonPayload.phoneNumber,
              uploadContentTypes: orderedPhotos.map((photo) => photo.file.type || "image/jpeg"),
              ...(options?.replaceExistingActiveTopicUpload
                ? { replaceExistingActiveTopicUpload: true }
                : {}),
              ...(options?.replaceFinalizedParticipantUpload
                ? { replaceFinalizedParticipantUpload: true }
                : {}),
            })

      const resolvedReference =
        marathonMode === "marathon" || Array.isArray(initialization)
          ? reference
          : initialization.reference
      const presignedUrls = Array.isArray(initialization) ? initialization : initialization.uploads

      if (!presignedUrls.length) {
        throw new Error("Failed to initialize upload URLs")
      }

      const preparedUploads: ParticipantPreparedUpload[] = orderedPhotos.map((photo, index) => {
        const urlData = presignedUrls[index]

        if (!urlData) {
          throw new Error(`Missing upload URL for image #${index + 1}`)
        }

        const contentTypeFromApi =
          "contentType" in urlData && typeof urlData.contentType === "string"
            ? urlData.contentType
            : undefined

        return {
          ...photo,
          key: urlData.key,
          presignedUrl: urlData.url,
          ...(contentTypeFromApi !== undefined ? { contentType: contentTypeFromApi } : {}),
        }
      })

      const initialUploadState: ParticipantUploadFileState[] = preparedUploads.map((photo) => ({
        ...photo,
        phase: PARTICIPANT_UPLOAD_PHASE.PRESIGNED,
        progress: 0,
        error: undefined,
      }))

      patchUpload({
        uploadFiles: initialUploadState,
        submittedReference: resolvedReference,
      })

      const { successKeys, failedKeys } = await uploadManualFiles({
        files: preparedUploads,
        onFileStateChange: updateUploadFileState,
      })

      if (successKeys.length > 0) {
        patchUpload({ isPollingStatus: true })
      }

      if (failedKeys.length === 0) return

      const message = `${failedKeys.length} photo${
        failedKeys.length === 1 ? "" : "s"
      } failed to upload`
      patchUpload({ uploadErrorMessage: message })
      toast.error(message)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to initialize upload"
      patchUpload({ uploadErrorMessage: message })
      toast.error(message)
    } finally {
      patchUpload({ isUploadingFiles: false })
    }
  }

  const handleLookup = async (reference: string) => {
    const normalizedReference = normalizeParticipantReference(reference)

    setFormField("reference", normalizedReference)
    patchParticipant({
      lookupErrorMessage: null,
      showOverwriteDialog: false,
      byCameraReplaceExistingTopicUpload: false,
      byCameraReplaceFinalizedParticipantUpload: false,
    })
    patchPhotos({ filesError: null })
    resetPhotoSelection()
    resetUploadFlow()

    try {
      const result = await lookupParticipantMutation.mutateAsync({
        domain,
        reference: normalizedReference,
      })

      const resolvedStatus = result.status as ParticipantExistenceStatus
      const outcome = resolveStaffLaptopUploadLookupOutcome({
        exists: result.exists,
        status: resolvedStatus,
      })

      patchParticipant({ participantStatus: resolvedStatus })

      if (outcome.kind === "blocked") {
        patchParticipant({
          existingParticipant: null,
          lookupErrorMessage: getBlockedMessage(resolvedStatus),
        })
        resetForm(normalizedReference)
        void setStep("reference")
        return
      }

      if (outcome.kind === "manual-entry") {
        patchParticipant({
          existingParticipant: null,
          byCameraReplaceExistingTopicUpload: false,
        })
        resetForm(normalizedReference)
        clearFormErrors()
        void setStep("details")
        return
      }

      const participant = await queryClient.fetchQuery(
        trpc.participants.getByReference.queryOptions({
          domain,
          reference: normalizedReference,
        }),
      )

      patchParticipant({
        existingParticipant: participant as StaffParticipant,
      })
      void setStep("upload")
    } catch (error) {
      console.error(error)
      patchParticipant({
        lookupErrorMessage:
          error instanceof Error ? error.message : "Failed to find participant for this reference.",
      })
    }
  }

  const handlePhoneLookup = async (phoneNumber: string) => {
    const trimmedPhone = phoneNumber.trim()

    setFormField("phone", trimmedPhone)
    patchParticipant({
      lookupErrorMessage: null,
      showOverwriteDialog: false,
      byCameraReplaceExistingTopicUpload: false,
      byCameraReplaceFinalizedParticipantUpload: false,
    })
    patchPhotos({ filesError: null })
    resetPhotoSelection()
    resetUploadFlow()

    try {
      const resolution = await resolveByCameraParticipantByPhone.mutateAsync({
        domain,
        phoneNumber: trimmedPhone,
      })

      if (!resolution.match) {
        patchParticipant({
          existingParticipant: null,
          participantStatus: null,
          lookupErrorMessage: null,
        })
        setFormField("reference", "")
        setFormField("firstName", "")
        setFormField("lastName", "")
        setFormField("email", "")
        clearFormErrors()
        void setStep("details")
        return
      }

      if (resolution.activeTopicUploadState === "already-uploaded") {
        setPendingByCameraReplacement({
          reference: resolution.reference,
          participantId: resolution.participantId,
        })
        setByCameraReplaceDialogOpen(true)
        return
      }

      const normalizedReference = normalizeParticipantReference(resolution.reference)

      const result = await lookupParticipantMutation.mutateAsync({
        domain,
        reference: normalizedReference,
      })

      const resolvedStatus = result.status as ParticipantExistenceStatus
      const outcome = resolveStaffLaptopUploadLookupOutcome({
        exists: result.exists,
        status: resolvedStatus,
      })

      patchParticipant({ participantStatus: resolvedStatus })

      if (outcome.kind === "manual-entry") {
        patchParticipant({ existingParticipant: null })
        toast.error("Could not load this participant from the server. Try the lookup again.")
        return
      }

      const participant = await queryClient.fetchQuery(
        trpc.participants.getByReference.queryOptions({
          domain,
          reference: normalizedReference,
        }),
      )

      const continuingAfterPriorTopicFinalize =
        outcome.kind === "blocked" && resolution.activeTopicUploadState === "eligible"

      patchParticipant({
        existingParticipant: participant as StaffParticipant,
        ...(continuingAfterPriorTopicFinalize
          ? {
              byCameraReplaceFinalizedParticipantUpload: true,
              byCameraReplaceExistingTopicUpload: false,
            }
          : {}),
      })
      setFormField("reference", normalizedReference)
      void setStep("upload")
    } catch (error) {
      console.error(error)
      patchParticipant({
        lookupErrorMessage:
          error instanceof Error
            ? error.message
            : "Could not look up this phone number. Try again.",
      })
    }
  }

  const handleContinueFromDetails = async () => {
    const errors = validateStaffUploadForm(marathonMode, formValues)

    if (errors) {
      setFormErrors(errors)
      return
    }

    patchParticipant({ lookupErrorMessage: null })
    clearFormErrors()
    void setStep("upload")
  }

  const handleConfirmByCameraReplace = async () => {
    if (!pendingByCameraReplacement) return

    const normalizedReference = normalizeParticipantReference(pendingByCameraReplacement.reference)

    setByCameraReplaceDialogOpen(false)
    setPendingByCameraReplacement(null)

    try {
      const result = await lookupParticipantMutation.mutateAsync({
        domain,
        reference: normalizedReference,
      })

      const resolvedStatus = result.status as ParticipantExistenceStatus
      const outcome = resolveStaffLaptopUploadLookupOutcome({
        exists: result.exists,
        status: resolvedStatus,
      })

      patchParticipant({ participantStatus: resolvedStatus })

      if (outcome.kind === "blocked") {
        const participant = await queryClient.fetchQuery(
          trpc.participants.getByReference.queryOptions({
            domain,
            reference: normalizedReference,
          }),
        )

        patchParticipant({
          byCameraReplaceExistingTopicUpload: true,
          byCameraReplaceFinalizedParticipantUpload: true,
          lookupErrorMessage: null,
          existingParticipant: participant as StaffParticipant,
          participantStatus: participant.status as ParticipantExistenceStatus,
        })
        setFormField("reference", normalizedReference)
        clearFormErrors()
        void setStep("upload")
        return
      }

      if (outcome.kind === "manual-entry") {
        patchParticipant({
          lookupErrorMessage:
            "This participant is not in the expected state. Try the phone lookup again.",
          existingParticipant: null,
        })
        void setStep("phone")
        return
      }

      const participant = await queryClient.fetchQuery(
        trpc.participants.getByReference.queryOptions({
          domain,
          reference: normalizedReference,
        }),
      )

      patchParticipant({
        byCameraReplaceExistingTopicUpload: true,
        byCameraReplaceFinalizedParticipantUpload: false,
        lookupErrorMessage: null,
        existingParticipant: participant as StaffParticipant,
      })
      setFormField("reference", normalizedReference)
      clearFormErrors()
      void setStep("upload")
    } catch (error) {
      console.error(error)
      toast.error(
        error instanceof Error ? error.message : "Could not prepare replace upload. Try again.",
      )
      void setStep("phone")
    }
  }

  const handleSubmitUpload = async () => {
    if (!participantSummary) {
      toast.error("Participant details are missing.")
      return
    }

    const filesValidationError = validateStaffUploadFiles({
      marathonMode,
      expectedPhotoCount,
      selectedPhotosCount: selectedPhotos.length,
      validationResults,
      validationRunError,
    })

    if (filesValidationError) {
      patchPhotos({ filesError: filesValidationError })
      return
    }

    const participantPayload = existingParticipant
      ? {
          firstName: existingParticipant.firstname,
          lastName: existingParticipant.lastname,
          email: existingParticipant.email ?? "",
          phone: marathonMode === "by-camera" ? (existingParticipant.phoneNumber ?? "").trim() : "",
          competitionClassId: String(existingParticipant.competitionClassId),
          deviceGroupId: String(existingParticipant.deviceGroupId),
        }
      : formValues

    if (requiresOverwriteWarning) {
      patchParticipant({ showOverwriteDialog: true })
      return
    }

    void setStep("progress")
    await runUpload(participantSummary.reference, selectedPhotos, participantPayload, {
      replaceExistingActiveTopicUpload: byCameraReplaceExistingTopicUpload,
      replaceFinalizedParticipantUpload: byCameraReplaceFinalizedParticipantUpload,
    })
  }

  const handleConfirmOverwrite = async () => {
    if (!participantSummary || !existingParticipant) return

    patchParticipant({ showOverwriteDialog: false })
    void setStep("progress")
    await runUpload(
      participantSummary.reference,
      selectedPhotos,
      {
        firstName: existingParticipant.firstname,
        lastName: existingParticipant.lastname,
        email: existingParticipant.email ?? "",
        phone: marathonMode === "by-camera" ? (existingParticipant.phoneNumber ?? "").trim() : "",
        competitionClassId: String(existingParticipant.competitionClassId),
        deviceGroupId: String(existingParticipant.deviceGroupId),
      },
      {
        replaceExistingActiveTopicUpload: byCameraReplaceExistingTopicUpload,
        replaceFinalizedParticipantUpload: byCameraReplaceFinalizedParticipantUpload,
      },
    )
  }

  const showFloatingBar = step === "details" || step === "upload"
  const submitDisabled =
    isBusy ||
    selectedPhotos.length !== expectedPhotoCount ||
    validationResults.some((result) => result.outcome === "failed" && result.severity === "error")

  return (
    <>
      <div className="relative min-h-screen">
        <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-lg">
          <div className="relative mx-auto flex max-w-3xl items-center px-6 py-4">
            <div className="absolute inset-0 flex items-center justify-center">
              <StepIndicator />
            </div>

            <div className="relative z-10 ml-auto flex items-center gap-2.5">
              <span className="hidden text-sm font-medium text-muted-foreground sm:inline">
                {marathon.name}
              </span>
              <Avatar className="h-7 w-7 ring-1 ring-border">
                {staffImage ? <AvatarImage src={staffImage} alt={staffName ?? ""} /> : null}
                <AvatarFallback className="bg-muted text-[10px] font-semibold">
                  {getStaffInitials(staffName, staffEmail)}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        <div className={cn("mx-auto max-w-3xl px-6 py-6", showFloatingBar && "pb-28")}>
          <motion.div
            key={step}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            {step === "phone" && marathonMode === "by-camera" ? (
              byCameraSubmissionWindowState !== "open" ? (
                <StaffByCameraSubmissionWindowGate
                  state={byCameraSubmissionWindowState}
                  topicName={activeByCameraTopic?.name ?? null}
                  scheduledStart={activeByCameraTopic?.scheduledStart ?? null}
                  scheduledEnd={activeByCameraTopic?.scheduledEnd ?? null}
                />
              ) : (
                <PhoneLookupStep
                  isSubmitting={
                    resolveByCameraParticipantByPhone.isPending ||
                    lookupParticipantMutation.isPending
                  }
                  onSubmitAction={handlePhoneLookup}
                />
              )
            ) : null}

            {step === "reference" && marathonMode === "marathon" ? (
              <ReferenceStep
                isSubmitting={lookupParticipantMutation.isPending}
                onSubmitAction={handleLookup}
              />
            ) : null}

            {step === "details" ? <ParticipantDetailsStep isBusy={isBusy} /> : null}

            {step === "upload" ? (
              <UploadStep isBusy={isBusy} dropzoneDisabled={isDropzoneDisabled} />
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
                    setByCameraReplaceDialogOpen(false)
                    setPendingByCameraReplacement(null)
                    patchParticipant({
                      lookupErrorMessage: null,
                      existingParticipant: null,
                      participantStatus: null,
                      byCameraReplaceExistingTopicUpload: false,
                      byCameraReplaceFinalizedParticipantUpload: false,
                    })
                    patchPhotos({ filesError: null })

                    if (marathonMode === "by-camera") {
                      void setStep("phone")
                      return
                    }

                    resetForm(formValues.reference)
                    void setStep("reference")
                  }}
                  disabled={isBusy}
                >
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  Back
                </Button>
                <PrimaryButton
                  type="button"
                  className="rounded-full px-6"
                  onClick={() => void handleContinueFromDetails()}
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
                    patchPhotos({ filesError: null })

                    if (existingParticipant) {
                      resetPhotoSelection()
                      resetUploadFlow()
                      patchParticipant({
                        existingParticipant: null,
                        participantStatus: null,
                        showOverwriteDialog: false,
                        byCameraReplaceExistingTopicUpload: false,
                        byCameraReplaceFinalizedParticipantUpload: false,
                      })
                      void setStep(marathonMode === "by-camera" ? "phone" : "reference")
                      return
                    }

                    void setStep("details")
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
        open={byCameraReplaceDialogOpen}
        onOpenChange={(open) => {
          setByCameraReplaceDialogOpen(open)
          if (!open) setPendingByCameraReplacement(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace photo for current topic?</AlertDialogTitle>
            <AlertDialogDescription>
              This phone number already has a photo for the active topic. Continue to replace it
              with a new upload.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUploadBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isUploadBusy}
              onClick={(event) => {
                event.preventDefault()
                void handleConfirmByCameraReplace()
              }}
            >
              Replace and continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={showOverwriteDialog}
        onOpenChange={(open) => patchParticipant({ showOverwriteDialog: open })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace existing upload?</AlertDialogTitle>
            <AlertDialogDescription>
              This participant already has an upload in progress. Starting again will replace that
              upload.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUploadBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isUploadBusy}
              onClick={(event) => {
                event.preventDefault()
                void handleConfirmOverwrite()
              }}
            >
              Replace and upload
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
