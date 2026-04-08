"use client"

import { DownloadIcon, Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PrimaryButton } from "@/components/ui/primary-button"
import { useDomain } from "@/lib/domain-provider"
import { getUploadPhaseClassName, getUploadPhaseLabel } from "@/lib/upload-utils"
import { PARTICIPANT_UPLOAD_PHASE } from "@/lib/participant-upload-types"
import { uploadManualFiles } from "@/lib/manual-upload"
import { saveParticipantPhotosLocally } from "@/lib/local-save"
import { cn } from "@/lib/utils"
import { StaffParticipantCard } from "@/components/staff/staff-participant-card"
import { useStaffUploadParticipantSummary } from "@/hooks/staff/use-staff-upload-participant-summary"
import { useStaffUploadStep } from "@/hooks/staff/use-staff-upload-step"
import { useStaffUploadStore } from "@/lib/staff/staff-upload-store"

export function UploadProgressPanel() {
  const domain = useDomain()
  const [, setStep] = useStaffUploadStep()
  const participantSummary = useStaffUploadParticipantSummary()

  const files = useStaffUploadStore((s) => s.uploadFiles)
  const isUploadingFiles = useStaffUploadStore((s) => s.isUploadingFiles)
  const isPollingStatus = useStaffUploadStore((s) => s.isPollingStatus)
  const uploadErrorMessage = useStaffUploadStore((s) => s.uploadErrorMessage)
  const isSavingLocally = useStaffUploadStore((s) => s.isSavingLocally)
  const selectedPhotos = useStaffUploadStore((s) => s.selectedPhotos)

  const updateUploadFileState = useStaffUploadStore((s) => s.updateUploadFileState)
  const patchUpload = useStaffUploadStore((s) => s.patchUpload)

  const completed = files.filter((file) => file.phase === "completed").length
  const total = files.length
  const isWorking = isUploadingFiles || isPollingStatus
  const canRetryFailedUploads = files.some((file) => file.phase === "error")
  const canSaveLocally =
    (Boolean(uploadErrorMessage) || canRetryFailedUploads) &&
    !isSavingLocally &&
    selectedPhotos.length > 0
  const progressPercent = total > 0 ? (completed / total) * 100 : 0

  const handleRetryFailed = async () => {
    const failedUploads = files.filter((file) => file.phase === PARTICIPANT_UPLOAD_PHASE.ERROR)

    if (failedUploads.length === 0) return

    patchUpload({ uploadErrorMessage: null, isUploadingFiles: true })

    try {
      const { successKeys, failedKeys } = await uploadManualFiles({
        files: failedUploads,
        onFileStateChange: updateUploadFileState,
      })

      if (successKeys.length > 0) {
        patchUpload({ isPollingStatus: true })
      }

      if (failedKeys.length === 0) return

      const message = `${failedKeys.length} photo${failedKeys.length === 1 ? "" : "s"} still failing`
      patchUpload({ uploadErrorMessage: message })
      toast.error(message)
    } finally {
      patchUpload({ isUploadingFiles: false })
    }
  }

  const handleSaveLocally = async () => {
    if (!participantSummary || selectedPhotos.length === 0) return

    try {
      patchUpload({ isSavingLocally: true })
      const result = await saveParticipantPhotosLocally({
        domain,
        participantReference: participantSummary.reference,
        photos: selectedPhotos,
      })

      toast.success(
        result.mode === "directory"
          ? "Files saved to the selected folder."
          : "Backup zip downloaded.",
      )
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Failed to save files locally.")
    } finally {
      patchUpload({ isSavingLocally: false })
    }
  }

  if (!participantSummary) {
    return null
  }

  return (
    <div className="space-y-5">
      <StaffParticipantCard {...participantSummary} />

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Upload progress
            </p>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="font-gothic text-3xl font-medium leading-none tracking-tight text-foreground">
                {completed}/{total || files.length || 0}
              </span>
              <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
                {isWorking ? "In progress" : "Paused"}
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canRetryFailedUploads ? (
              <PrimaryButton
                type="button"
                className="rounded-full text-sm"
                onClick={() => void handleRetryFailed()}
                disabled={isUploadingFiles}
              >
                {isUploadingFiles ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                )}
                Retry failed
              </PrimaryButton>
            ) : null}
            {canSaveLocally ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-full text-sm"
                onClick={() => void handleSaveLocally()}
              >
                <DownloadIcon className="mr-1.5 h-3.5 w-3.5" />
                Save locally
              </Button>
            ) : null}
            {!isWorking && !canRetryFailedUploads ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-full text-sm"
                onClick={() => void setStep("upload")}
              >
                Back to photos
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              isWorking ? "bg-foreground" : "bg-emerald-500",
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {uploadErrorMessage ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {uploadErrorMessage}
          </div>
        ) : null}
      </div>

      {files.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Files
          </p>
          {files.map((file) => (
            <div key={file.key} className="rounded-xl border border-border bg-card px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{file.file.name}</p>
                  <p className="text-xs text-muted-foreground">Photo #{file.orderIndex + 1}</p>
                </div>
                <Badge
                  variant="outline"
                  className={cn("shrink-0 text-xs", getUploadPhaseClassName(file.phase))}
                >
                  {file.phase === "uploading" ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : null}
                  {getUploadPhaseLabel(file.phase)}
                </Badge>
              </div>
              {file.error ? (
                <p className="mt-2 text-xs text-rose-600">{file.error.message}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-muted px-5 py-10 text-center text-sm text-muted-foreground">
          Preparing upload&hellip;
        </div>
      )}
    </div>
  )
}
