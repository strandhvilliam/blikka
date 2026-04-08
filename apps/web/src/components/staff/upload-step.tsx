"use client"

import { AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { buildPhotoValidationMap, splitValidationResultsBySeverity } from "@/lib/validation"
import { getExpectedPhotoCount, getSelectedTopics } from "@/lib/upload-utils"
import { processSelectedFiles } from "@/lib/participant-selected-files"
import { StaffParticipantCard } from "@/components/staff/staff-participant-card"
import { StaffDropzone } from "@/components/staff/staff-dropzone"
import { StaffPhotoList } from "@/components/staff/staff-photo-grid"
import { useStaffUploadParticipantSummary } from "@/hooks/staff/use-staff-upload-participant-summary"
import {
  useStaffUploadStore,
  selectRequiresOverwriteWarning,
} from "@/lib/staff/staff-upload-store"
import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import { useSuspenseQuery } from "@tanstack/react-query"
import { UploadMarathonMode } from "@/lib/types"

interface UploadStepProps {
  isBusy: boolean
  dropzoneDisabled: boolean
}

export function UploadStep({ isBusy, dropzoneDisabled }: UploadStepProps) {
  const domain = useDomain()
  const trpc = useTRPC()
  const { data: marathon } = useSuspenseQuery(trpc.marathons.getByDomain.queryOptions({ domain }))

  const participantSummary = useStaffUploadParticipantSummary()
  const requiresOverwriteWarning = useStaffUploadStore(selectRequiresOverwriteWarning)

  const selectedPhotos = useStaffUploadStore((s) => s.selectedPhotos)
  const validationResults = useStaffUploadStore((s) => s.validationResults)
  const isProcessingFiles = useStaffUploadStore((s) => s.isProcessingFiles)
  const filesError = useStaffUploadStore((s) => s.filesError)
  const existingParticipant = useStaffUploadStore((s) => s.existingParticipant)
  const formValues = useStaffUploadStore((s) => s.formValues)
  const uploadComplete = useStaffUploadStore((s) => s.uploadComplete)

  const removeSelectedPhoto = useStaffUploadStore((s) => s.removeSelectedPhoto)
  const setSelectedPhotos = useStaffUploadStore((s) => s.setSelectedPhotos)
  const resetUploadFlow = useStaffUploadStore((s) => s.resetUploadFlow)
  const patchPhotos = useStaffUploadStore((s) => s.patchPhotos)

  const marathonMode = marathon.mode as UploadMarathonMode
  const sortedTopics = marathon.topics.toSorted((a, b) => a.orderIndex - b.orderIndex)
  const activeByCameraTopic = sortedTopics.find((topic) => topic.visibility === "active") ?? null
  const activeCompetitionClassId = existingParticipant
    ? String(existingParticipant.competitionClassId)
    : formValues.competitionClassId
  const selectedCompetitionClass =
    marathon.competitionClasses.find((cc) => cc.id === Number(activeCompetitionClassId)) ?? null

  const selectedTopics = getSelectedTopics(
    marathonMode,
    activeByCameraTopic,
    selectedCompetitionClass,
    sortedTopics,
  )
  const expectedPhotoCount = getExpectedPhotoCount(
    marathonMode,
    activeByCameraTopic,
    selectedCompetitionClass,
  )
  const topicOrderIndexes = selectedTopics.map((topic) => topic.orderIndex)

  const activeDeviceGroupId = existingParticipant
    ? String(existingParticipant.deviceGroupId)
    : formValues.deviceGroupId
  const selectedDeviceGroupForFiles =
    marathon.deviceGroups.find((dg) => dg.id === Number(activeDeviceGroupId)) ?? null
  const canProcessFiles =
    marathonMode === "by-camera"
      ? Boolean(activeByCameraTopic && selectedDeviceGroupForFiles)
      : Boolean(selectedCompetitionClass && selectedDeviceGroupForFiles)

  const { blocking: blockingValidationErrors, warnings: warningValidationResults } =
    splitValidationResultsBySeverity(validationResults)
  const photoValidationMap = buildPhotoValidationMap(selectedPhotos, validationResults)
  const selectedCount = selectedPhotos.length
  const blockingErrorCount = blockingValidationErrors.length
  const warningCount = warningValidationResults.length
  const isComplete = selectedCount >= expectedPhotoCount && expectedPhotoCount > 0

  const handleFilesSelected = async (files: File[]) => {
    if (isBusy || uploadComplete || !canProcessFiles) {
      return
    }

    patchPhotos({ isProcessingFiles: true })
    resetUploadFlow()

    try {
      const result = await processSelectedFiles({
        fileList: files,
        existingPhotos: selectedPhotos,
        maxPhotos: expectedPhotoCount,
        topicOrderIndexes,
      })

      if (result.errors.length > 0) {
        result.errors.forEach((message) => toast.error(message))
      }

      if (result.warnings.length > 0) {
        result.warnings.forEach((message) => toast.message(message))
      }

      if (result.photos !== selectedPhotos) {
        setSelectedPhotos(result.photos)
        patchPhotos({ filesError: null })
      }
    } finally {
      patchPhotos({ isProcessingFiles: false })
    }
  }

  if (!participantSummary) {
    return null
  }

  return (
    <div className="space-y-6">
      <StaffParticipantCard {...participantSummary} />

      {requiresOverwriteWarning ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>This participant already has an upload in progress. Starting again will replace it.</p>
        </div>
      ) : null}

      <StaffDropzone
        disabled={dropzoneDisabled}
        onFilesSelected={handleFilesSelected}
        isProcessing={isProcessingFiles}
        selectedCount={selectedCount}
        expectedCount={expectedPhotoCount}
        errorMessage={filesError}
      />

      <StaffPhotoList
        photos={selectedPhotos}
        expectedCount={expectedPhotoCount}
        topics={selectedTopics}
        photoValidationMap={photoValidationMap}
        isBusy={isBusy}
        onRemove={(photoId) => {
          resetUploadFlow()
          removeSelectedPhoto(photoId, topicOrderIndexes)
        }}
      />

      {(blockingErrorCount > 0 || warningCount > 0) && selectedPhotos.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {blockingErrorCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              {blockingErrorCount} issue{blockingErrorCount !== 1 ? "s" : ""} to fix
            </span>
          ) : null}
          {warningCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              {warningCount} warning{warningCount !== 1 ? "s" : ""}
            </span>
          ) : null}
        </div>
      ) : null}

      {isComplete && blockingErrorCount === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-center text-sm font-medium text-emerald-700">
          Ready to upload &mdash; review the photos above, then press Start upload
        </div>
      ) : null}
    </div>
  )
}
