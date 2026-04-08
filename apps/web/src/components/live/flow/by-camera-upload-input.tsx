"use client"
/* eslint-disable @next/next/no-img-element */

import { Button } from "@/components/ui/button"
import { PrimaryButton } from "@/components/ui/primary-button"
import { useTranslations } from "next-intl"
import { motion } from "motion/react"
import { useRef, useState, useMemo, type RefObject } from "react"
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CloudUpload,
  Info,
  Loader2,
  X,
} from "lucide-react"
import { format } from "date-fns"
import { COMMON_IMAGE_EXTENSIONS } from "@/lib/file-processing"
import { cn } from "@/lib/utils"
import { ValidationStatusBadge } from "./validation-status-badge"
import type { SelectedPhoto } from "@/lib/flow/types"
import { VALIDATION_OUTCOME } from "@blikka/validation"
import {
  byCameraBreadcrumb,
  captureByCameraMessage,
  fileSummaryForSentry,
  summarizeFileListForSentry,
} from "@/lib/sentry-by-camera"

interface ValidationSummary {
  status: "pending" | "passed" | "warning" | "error"
  outcome?: (typeof VALIDATION_OUTCOME)[keyof typeof VALIDATION_OUTCOME]
  severity?: "error" | "warning"
  messages: string[]
}

function getValidationSummary(
  validationResults: Array<{
    outcome: (typeof VALIDATION_OUTCOME)[keyof typeof VALIDATION_OUTCOME]
    severity?: "error" | "warning"
    message: string
  }>,
  hasValidationRules: boolean,
): ValidationSummary {
  if (validationResults.length === 0) {
    if (!hasValidationRules) {
      return { status: "passed", outcome: VALIDATION_OUTCOME.PASSED, messages: [] }
    }
    return { status: "pending", messages: [] }
  }

  const blockingError = validationResults.find(
    (r) => r.outcome === VALIDATION_OUTCOME.FAILED && r.severity === "error",
  )
  if (blockingError) {
    return {
      status: "error",
      outcome: blockingError.outcome,
      severity: "error",
      messages: validationResults
        .filter((r) => r.outcome !== VALIDATION_OUTCOME.PASSED)
        .map((r) => r.message),
    }
  }

  const warning = validationResults.find((r) => r.outcome !== VALIDATION_OUTCOME.PASSED)
  if (warning) {
    return {
      status: "warning",
      outcome: warning.outcome,
      severity: warning.severity ?? "warning",
      messages: validationResults
        .filter((r) => r.outcome !== VALIDATION_OUTCOME.PASSED)
        .map((r) => r.message),
    }
  }

  return { status: "passed", outcome: VALIDATION_OUTCOME.PASSED, messages: [] }
}

function getTimeTaken(exif?: Record<string, unknown>): Date | null {
  if (!exif?.DateTimeOriginal) return null
  try {
    const dateString = String(exif.DateTimeOriginal)
    const date = new Date(dateString)
    if (!Number.isNaN(date.getTime())) return date
  } catch {
    // ignore
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
      // Skip
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

function ByCameraSelectedPhotoPreview({ photo }: { photo: SelectedPhoto }) {
  const t = useTranslations("FlowPage.uploadStep")
  const [previewLoadFailed, setPreviewLoadFailed] = useState(false)

  return (
    <div className="flex w-full justify-center bg-muted">
      {previewLoadFailed ? (
        <div className="flex min-h-[min(52dvh,12rem)] w-full flex-col items-center justify-center gap-2 px-6 py-10 text-center">
          <Info className="h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium text-foreground">{t("previewUnavailable")}</p>
          <p className="text-xs text-muted-foreground">{t("previewUnavailableHint")}</p>
        </div>
      ) : (
        <img
          src={photo.preview}
          alt={t("photoPreview")}
          className="max-h-[min(52dvh,30rem)] w-full object-contain"
          onError={() => {
            setPreviewLoadFailed(true)
            captureByCameraMessage("by_camera_preview_img_error", {
              level: "info",
              extra: {
                file: fileSummaryForSentry(photo.file),
              },
            })
          }}
        />
      )}
    </div>
  )
}

interface UploadInputProps {
  photo: SelectedPhoto | null
  validationResults: Array<{
    outcome: (typeof VALIDATION_OUTCOME)[keyof typeof VALIDATION_OUTCOME]
    severity?: "error" | "warning"
    message: string
  }>
  hasValidationRules: boolean
  isProcessing: boolean
  fileInputRef?: RefObject<HTMLInputElement | null>
  onFileSelect: (files: FileList | null) => Promise<void>
  onRemovePhoto: (orderIndex: number) => void
}

export function ByCameraUploadInput({
  photo,
  validationResults,
  hasValidationRules,
  isProcessing,
  fileInputRef,
  onFileSelect,
  onRemovePhoto,
}: UploadInputProps) {
  const t = useTranslations("FlowPage.uploadStep")
  const internalFileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = fileInputRef ?? internalFileInputRef
  const [isDragOver, setIsDragOver] = useState(false)
  const [exifExpanded, setExifExpanded] = useState(false)

  const exifData = photo?.exif || {}
  const relevantExifData = getRelevantExifData(exifData)
  const hasExifData = Object.keys(relevantExifData).length > 0

  const validationSummary = useMemo(
    () => getValidationSummary(validationResults, hasValidationRules),
    [validationResults, hasValidationRules],
  )

  const takenAt = photo ? getTimeTaken(photo.exif) : null

  const handleChooseClick = () => {
    if (isProcessing) return
    inputRef.current?.click()
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (isProcessing) return
    if (e.dataTransfer.files?.length > 0) {
      await onFileSelect(e.dataTransfer.files)
    }
  }

  return (
    <>
      <motion.div
        key={photo ? "preview" : "dropzone"}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {!photo ? (
          <div
            className={cn(
              "flex flex-col items-center rounded-2xl border-2 border-dashed bg-white px-6 py-10 text-center transition-all",
              isProcessing && "cursor-progress opacity-70",
              !isProcessing && "cursor-pointer",
              isDragOver
                ? "border-foreground/40 scale-[1.01]"
                : "border-foreground/20 hover:border-foreground/40",
            )}
            onClick={handleChooseClick}
            onDragEnter={(e) => {
              e.preventDefault()
              setIsDragOver(true)
            }}
            onDragLeave={(e) => {
              e.preventDefault()
              setIsDragOver(false)
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-foreground/6">
              {isProcessing ? (
                <Loader2 className="h-7 w-7 animate-spin text-foreground/50" />
              ) : (
                <CloudUpload className="h-7 w-7 text-foreground/50" />
              )}
            </div>

            <p className="mt-4 text-sm font-medium text-foreground">
              {t("selectPhotoPrompt")}
            </p>

            <PrimaryButton
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleChooseClick()
              }}
              disabled={isProcessing}
              className="mt-5 rounded-full px-8"
            >
              {t("chooseFromLibrary")}
            </PrimaryButton>

            <p className="mt-4 text-[11px] text-muted-foreground">
              {t("supportedFormatsShort", {
                formats: COMMON_IMAGE_EXTENSIONS.map((ext) => ext.toUpperCase()).join(", "),
              })}
            </p>
          </div>
        ) : (
          <div
            className={cn(
              "relative overflow-hidden rounded-2xl border-2 bg-white",
              validationSummary.status === "error"
                ? "border-destructive/40"
                : validationSummary.status === "warning"
                  ? "border-amber-300/60"
                  : "border-border",
            )}
          >
            {/* Remove button */}
            <button
              type="button"
              onClick={() => onRemovePhoto(photo.orderIndex)}
              className="absolute top-2.5 right-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur transition-colors hover:bg-white"
            >
              <X className="h-4 w-4 text-muted-foreground" />
              <span className="sr-only">{t("remove")}</span>
            </button>

            {/* Image — cap height so very tall screenshots stay on-screen */}
            <ByCameraSelectedPhotoPreview key={photo.id} photo={photo} />

            {/* Info section */}
            <div className="px-4 py-3.5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-foreground">{t("yourPhoto")}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{photo.file.name}</p>
                </div>
                <div className="shrink-0">
                  <ValidationStatusBadge
                    outcome={validationSummary.outcome}
                    severity={validationSummary.severity}
                  />
                </div>
              </div>

              {takenAt && (
                <p className="text-xs text-muted-foreground">
                  {t("taken")} {format(takenAt, "yyyy-MM-dd HH:mm")}
                </p>
              )}

              {validationSummary.messages.length > 0 && (
                <div
                  className={cn(
                    "rounded-xl border p-3 text-xs",
                    validationSummary.status === "error" &&
                      "border-destructive/30 bg-destructive/5 text-destructive",
                    validationSummary.status === "warning" &&
                      "border-amber-300/50 bg-amber-50 text-amber-900",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <ul className="space-y-0.5">
                      {validationSummary.messages.slice(0, 3).map((message) => (
                        <li key={message} className="leading-snug">
                          {message}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {!hasExifData && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
                  <span className="leading-snug">{t("noExifData")}</span>
                </div>
              )}
            </div>

            {/* EXIF details toggle */}
            {hasExifData && (
              <div className="border-t border-dashed border-border px-4 py-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setExifExpanded(!exifExpanded)}
                >
                  <Info className="h-3.5 w-3.5" />
                  <span>{t("photoDetails")}</span>
                  {exifExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            )}

            {exifExpanded && hasExifData && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-border px-4 pb-3"
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
          </div>
        )}
      </motion.div>

      <input
        ref={inputRef}
        type="file"
        accept={COMMON_IMAGE_EXTENSIONS.map((ext) => `.${ext}`).join(",")}
        onChange={async (e) => {
          const target = e.currentTarget
          const picked = target.files
          if (picked && picked.length > 0) {
            byCameraBreadcrumb("native_file_input_change", {
              ...summarizeFileListForSentry(Array.from(picked)),
            })
          }
          await onFileSelect(picked)
          target.value = ""
        }}
        disabled={isProcessing}
        className="hidden"
      />
    </>
  )
}
