"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Topic } from "@blikka/db"
import { format } from "date-fns"
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ImageIcon,
  Info,
  X,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { motion } from "motion/react"
import { useState } from "react"
import type { SelectedPhoto } from "@/lib/flow/types"
import { VALIDATION_OUTCOME, type ValidationResult } from "@blikka/validation"
import { ValidationStatusBadge } from "./validation-status-badge"

interface SubmissionItemProps {
  photo?: SelectedPhoto
  validationResults?: ValidationResult[]
  topic?: Topic
  index: number
  onRemove?: (orderIndex: number) => void
  onUploadClick?: () => void
}

export function SubmissionItem({
  photo,
  validationResults,
  topic,
  index,
  onRemove,
  onUploadClick,
}: SubmissionItemProps) {
  const t = useTranslations("FlowPage.uploadStep")
  const [expanded, setExpanded] = useState(false)
  const [showImageDialog, setShowImageDialog] = useState(false)

  const exifData = photo?.exif || {}
  const relevantExifData = getRelevantExifData(exifData)
  const hasExifData = Object.keys(relevantExifData).length > 0
  const takenAt = getTimeTaken(photo?.exif)

  const sortedValidationResults = validationResults?.toSorted((a, b) => {
    if (a.outcome !== b.outcome) {
      if (a.outcome === VALIDATION_OUTCOME.FAILED) return -1
      if (b.outcome === VALIDATION_OUTCOME.FAILED) return 1
      if (a.outcome === VALIDATION_OUTCOME.SKIPPED) return -1
      if (b.outcome === VALIDATION_OUTCOME.SKIPPED) return 1
    }
    if (a.severity !== b.severity) {
      if (a.severity === "error") return -1
      if (b.severity === "error") return 1
    }
    return 0
  })

  const highestPriorityResult = sortedValidationResults?.[0]
  const displayValidation = {
    message: highestPriorityResult?.message,
    outcome: highestPriorityResult?.outcome,
    severity: highestPriorityResult?.severity,
    ruleKey: highestPriorityResult?.ruleKey,
  }

  if (!photo) {
    return (
      <div
        className={`flex gap-3 rounded-2xl border-2 border-dashed border-border bg-white p-3 ${
          onUploadClick ? "cursor-pointer transition-colors hover:border-muted-foreground/40" : ""
        }`}
        onClick={onUploadClick}
      >
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-muted/30">
          <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
        </div>
        <div className="min-w-0 flex-1 py-0.5">
          <p className="text-xs font-semibold text-muted-foreground">#{index + 1}</p>
          <p className="mt-0.5 text-base font-semibold text-foreground">{topic?.name}</p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {onUploadClick ? t("tapToSelect") : t("noPhotoSelected")}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-border bg-white">
      {/* Remove button */}
      <button
        type="button"
        onClick={() => onRemove?.(photo.orderIndex)}
        className="absolute top-2.5 right-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-muted transition-colors hover:bg-muted-foreground/20"
      >
        <X className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      <div className="flex gap-3 p-3">
        {/* Thumbnail */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          className="h-24 w-24 shrink-0 overflow-hidden rounded-xl"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.preview}
            alt={t("uploadPreviewAlt", { index: index + 1 })}
            className="h-full w-full cursor-pointer object-cover"
            onClick={() => setShowImageDialog(true)}
          />
        </motion.div>

        {/* Info */}
        <div className="min-w-0 flex-1 py-0.5">
          <p className="text-xs font-semibold text-muted-foreground">#{index + 1}</p>
          <p className="mt-0.5 text-base font-semibold text-foreground">{topic?.name}</p>

          {validationResults && validationResults.length === 0 && (
            <div className="mt-1.5 flex items-center gap-2">
              <ValidationStatusBadge outcome={VALIDATION_OUTCOME.PASSED} severity="error" />
            </div>
          )}

          {validationResults && validationResults.length > 0 && (
            <div className="mt-1.5 space-y-0.5">
              <ValidationStatusBadge
                outcome={displayValidation.outcome}
                severity={displayValidation.severity}
              />
              {displayValidation.message &&
                displayValidation.outcome !== VALIDATION_OUTCOME.PASSED && (
                  <p
                    className={`text-xs ${
                      displayValidation.severity === "error"
                        ? "text-destructive"
                        : displayValidation.outcome === VALIDATION_OUTCOME.FAILED
                          ? "text-amber-700"
                          : "text-muted-foreground"
                    }`}
                  >
                    {displayValidation.message}
                  </p>
                )}
            </div>
          )}

          <p className="mt-1 truncate text-[11px] text-muted-foreground">
            {takenAt && `${format(takenAt, "cccc, HH:mm")}`}
            {takenAt && photo.file.name && " · "}
            {photo.file.name}
          </p>
        </div>
      </div>

      {/* Photo details toggle, or no-EXIF notice in the same footer row */}
      <div
        className={`border-t border-dashed border-border px-3 py-2 ${!hasExifData ? "bg-amber-50/60" : ""}`}
      >
        {hasExifData ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setExpanded(!expanded)}
          >
            <Info className="h-3.5 w-3.5" />
            <span>{t("photoDetails")}</span>
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        ) : (
          <div
            role="alert"
            className="flex items-start gap-2 text-xs text-amber-900"
          >
            <AlertTriangle
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600"
              aria-hidden
            />
            <span className="min-w-0 leading-snug">{t("noExifData")}</span>
          </div>
        )}
      </div>

      {expanded && hasExifData && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="border-t border-dashed border-border px-4 pb-3"
        >
          <table className="mt-2 w-full text-xs">
            <tbody>
              {Object.entries(relevantExifData).map(([key, value]) => (
                <tr key={key} className="border-b border-border/50 last:border-b-0">
                  <td className="py-1.5 font-medium text-muted-foreground">{key}</td>
                  <td className="py-1.5 text-right text-foreground">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}

      {showImageDialog && (
        <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
          <DialogContent className="max-h-[90vh] max-w-4xl p-0">
            <DialogHeader className="p-6 pb-0">
              <DialogTitle>{t("photoPreviewTitle", { topic: topic?.name ?? "" })}</DialogTitle>
            </DialogHeader>
            <div className="p-6 pt-0">
              <div className="max-h-[70vh] w-full overflow-auto">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.preview}
                  alt={t("fullPreviewAlt", { index: index + 1 })}
                  className="h-auto w-full object-contain"
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function getTimeTaken(exif?: Record<string, unknown>): Date | null {
  if (!exif?.DateTimeOriginal) return null
  try {
    const dateString = String(exif.DateTimeOriginal)
    const date = new Date(dateString)
    if (!Number.isNaN(date.getTime())) return date
  } catch {
    // Skip if date parsing fails
  }
  return null
}

function getRelevantExifData(exif: Record<string, unknown>): Record<string, string> {
  const relevantData: Record<string, string> = {}
  if (!exif) return relevantData

  if (exif.Make && typeof exif.Make === "string") relevantData["Camera Make"] = exif.Make
  if (exif.Model && typeof exif.Model === "string") relevantData["Camera Model"] = exif.Model

  if (exif.ExposureTime && typeof exif.ExposureTime === "number") {
    const exposureValue = exif.ExposureTime
    relevantData["Exposure"] =
      exposureValue < 1 ? `1/${Math.round(1 / exposureValue)}s` : `${exposureValue}s`
  }

  if (exif.FNumber && typeof exif.FNumber === "number")
    relevantData["Aperture"] = `f/${exif.FNumber}`

  if (exif.ISO && (typeof exif.ISO === "number" || typeof exif.ISO === "string"))
    relevantData["ISO"] = `ISO ${exif.ISO}`

  if (exif.FocalLength && typeof exif.FocalLength === "number")
    relevantData["Focal Length"] = `${exif.FocalLength}mm`

  if (exif.DateTimeOriginal) {
    try {
      const dateString = String(exif.DateTimeOriginal)
      const date = new Date(dateString)
      if (!Number.isNaN(date.getTime())) {
        relevantData["Date Taken"] = date.toLocaleDateString()
        relevantData["Time Taken"] = date.toLocaleTimeString()
      }
    } catch {
      // Skip if date parsing fails
    }
  }

  if (exif.LensModel && typeof exif.LensModel === "string") relevantData["Lens"] = exif.LensModel

  if (
    exif.latitude &&
    exif.longitude &&
    typeof exif.latitude === "number" &&
    typeof exif.longitude === "number"
  ) {
    relevantData["GPS"] = `${exif.latitude.toFixed(6)}, ${exif.longitude.toFixed(6)}`
  }

  return relevantData
}
