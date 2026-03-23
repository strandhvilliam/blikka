"use client"
/* eslint-disable @next/next/no-img-element */

import { Button } from "@/components/ui/button"
import { PrimaryButton } from "@/components/ui/primary-button"
import { useTranslations } from "next-intl"
import { motion } from "motion/react"
import { useRef, useState, useMemo } from "react"
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileImage,
  Info,
  Loader2,
} from "lucide-react"
import { format } from "date-fns"
import { COMMON_IMAGE_EXTENSIONS } from "@/lib/file-processing"
import { ValidationStatusBadge } from "./validation-status-badge"
import type { SelectedPhoto } from "../_lib/types"
import { VALIDATION_OUTCOME } from "@blikka/validation"
import { Icon } from "@iconify/react"

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
    // If no rules configured, show as passed
    if (!hasValidationRules) {
      return {
        status: "passed",
        outcome: VALIDATION_OUTCOME.PASSED,
        messages: [],
      }
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

  const warning = validationResults.find(
    (r) => r.outcome !== VALIDATION_OUTCOME.PASSED,
  )
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

  return {
    status: "passed",
    outcome: VALIDATION_OUTCOME.PASSED,
    messages: [],
  }
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

  if (exif.Make && typeof exif.Make === "string")
    relevantData["Camera Make"] = exif.Make
  if (exif.Model && typeof exif.Model === "string")
    relevantData["Camera Model"] = exif.Model

  if (exif.ExposureTime && typeof exif.ExposureTime === "number") {
    const exposureValue = exif.ExposureTime
    relevantData["Exposure"] =
      exposureValue < 1
        ? `1/${Math.round(1 / exposureValue)}s`
        : `${exposureValue}s`
  }

  if (exif.FNumber && typeof exif.FNumber === "number") {
    relevantData["Aperture"] = `f/${exif.FNumber}`
  }

  if (
    exif.ISO &&
    (typeof exif.ISO === "number" || typeof exif.ISO === "string")
  ) {
    relevantData["ISO"] = `ISO ${exif.ISO}`
  }

  if (exif.FocalLength && typeof exif.FocalLength === "number") {
    relevantData["Focal Length"] = `${exif.FocalLength}mm`
  }

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

  if (exif.LensModel && typeof exif.LensModel === "string") {
    relevantData["Lens"] = exif.LensModel
  }

  if (
    exif.latitude &&
    exif.longitude &&
    typeof exif.latitude === "number" &&
    typeof exif.longitude === "number"
  ) {
    relevantData["GPS"] =
      `${exif.latitude.toFixed(6)}, ${exif.longitude.toFixed(6)}`
  }

  return relevantData
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
  onFileSelect: (files: FileList | null) => Promise<void>
  onRemovePhoto: (orderIndex: number) => void
}

export function ByCameraUploadInput({
  photo,
  validationResults,
  hasValidationRules,
  isProcessing,
  onFileSelect,
  onRemovePhoto,
}: UploadInputProps) {
  const t = useTranslations("FlowPage.uploadStep")
  const fileInputRef = useRef<HTMLInputElement>(null)
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
    if (isProcessing) {
      return
    }

    fileInputRef.current?.click()
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    if (isProcessing) {
      return
    }

    if (e.dataTransfer.files?.length > 0) {
      await onFileSelect(e.dataTransfer.files)
    }
  }

  return (
    <>
      <motion.div
        key={photo ? "preview" : "dropzone"}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.2 }}
        className="relative"
      >
        {!photo ? (
          <div
            className={`relative border-2 border-dashed rounded-2xl p-10 sm:p-12 text-center transition-all duration-300 ${isProcessing
              ? "cursor-progress opacity-70"
              : "cursor-pointer"
              } ${isDragOver
                ? "border-primary bg-primary/5 scale-[1.02]"
                : "border-muted-foreground/25 bg-background hover:border-muted-foreground/50 hover:bg-muted/50"
              }`}
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
            <motion.div
              animate={{
                scale: isDragOver ? 1.1 : 1,
                rotate: isDragOver ? [0, -5, 5, 0] : 0,
              }}
              transition={{ duration: 0.3 }}
              className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-linear-to-r from-primary/5 to-primary/10 mb-6 shadow border"
            >
              {isDragOver ? (
                <FileImage className="w-12 h-12 text-primary" />
              ) : (
                <Icon
                  icon="solar:cloud-upload-broken"
                  className="w-13 h-13 text-primary"
                />
              )}
            </motion.div>

            <div className="space-y-3">
              <p className="text-xl font-medium text-foreground">
                {t("selectPhotoPrompt")}
              </p>
              {/* <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                {t("clickToSelect")}
              </p> */}
            </div>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <PrimaryButton
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleChooseClick()
                }}
                disabled={isProcessing}
                className="rounded-full px-8 py-3 text-base font-semibold whitespace-nowrap"
              >
                {isProcessing ? (
                  <Loader2 className="mr-1 h-5 w-5 shrink-0 animate-spin" />
                ) : (
                  <Icon
                    icon="solar:gallery-add-outline"
                    className="w-5 h-5 mr-1 shrink-0"
                  />
                )}
                <span className="whitespace-nowrap">
                  {t("chooseFromLibrary")}
                </span>
              </PrimaryButton>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              {t("supportedFormatsShort", {
                formats: COMMON_IMAGE_EXTENSIONS.map((ext) =>
                  ext.toUpperCase(),
                ).join(", "),
              })}
            </p>
          </div>
        ) : (
          <div
            className={[
              "rounded-3xl overflow-hidden border bg-background shadow-sm",
              validationSummary.status === "error" && "border-destructive/40",
              validationSummary.status === "warning" && "border-amber-300/60",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className="relative">
              <div className="w-full bg-muted">
                <img
                  src={photo.preview}
                  alt={t("photoPreview")}
                  className="h-full w-full object-contain min-h-[100px]"
                />
              </div>

              <div className="absolute left-4 top-4 flex items-center gap-2">
                <div className="rounded-full bg-background/85 backdrop-blur px-2 py-1">
                  <ValidationStatusBadge
                    outcome={validationSummary.outcome}
                    severity={validationSummary.severity}
                  />
                </div>
              </div>

              <div className="absolute right-4 top-4 flex gap-2">
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="rounded-full bg-background/85 backdrop-blur"
                  onClick={() => onRemovePhoto(photo.orderIndex)}
                >
                  <Icon
                    icon="solar:trash-bin-trash-outline"
                    className="h-5 w-5"
                  />
                  <span className="sr-only">{t("remove")}</span>
                </Button>
              </div>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium leading-tight">{t("yourPhoto")}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {photo.file.name}
                  </p>
                </div>
                {takenAt ? (
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-muted-foreground">
                      {t("taken")}
                    </p>
                    <p className="text-xs font-medium tabular-nums">
                      {format(takenAt, "yyyy-MM-dd HH:mm")}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                {hasExifData ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-1 px-2 h-7 text-xs"
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
                ) : (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-2xl border border-amber-300/50 bg-amber-50 px-3 py-2 text-xs text-amber-900"
                  >
                    <AlertTriangle
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600"
                      aria-hidden
                    />
                    <span className="leading-snug">{t("noExifData")}</span>
                  </div>
                )}
              </div>

              {exifExpanded && hasExifData && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="rounded-2xl border border-muted overflow-hidden"
                >
                  <table className="w-full text-xs">
                    <tbody>
                      {Object.entries(relevantExifData).map(([key, value]) => (
                        <tr
                          key={key}
                          className="border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                        >
                          <td className="py-1.5 px-3 font-medium text-muted-foreground">
                            {key}
                          </td>
                          <td className="py-1.5 px-3 text-right">{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </motion.div>
              )}

              {validationSummary.messages.length > 0 ? (
                <div
                  className={[
                    "rounded-2xl border p-3 text-sm",
                    validationSummary.status === "error" &&
                    "border-destructive/30 bg-destructive/5 text-destructive",
                    validationSummary.status === "warning" &&
                    "border-amber-300/50 bg-amber-50 text-amber-900",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div className="flex items-start gap-2">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    <ul className="space-y-1">
                      {validationSummary.messages.slice(0, 3).map((message) => (
                        <li key={message} className="leading-snug">
                          {message}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </motion.div>

      <input
        ref={fileInputRef}
        type="file"
        accept={COMMON_IMAGE_EXTENSIONS.map((ext) => `.${ext}`).join(",")}
        onChange={async (e) => {
          const target = e.currentTarget
          await onFileSelect(target.files)
          target.value = ""
        }}
        disabled={isProcessing}
        className="hidden"
      />
    </>
  )
}
