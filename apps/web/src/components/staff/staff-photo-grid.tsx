"use client"
/* eslint-disable @next/next/no-img-element */

import { Trash2 } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getExifDate } from "@/lib/exif-parsing"
import type { ParticipantSelectedPhoto } from "@/lib/participant-upload-types"
import type { ValidationResult } from "@blikka/validation"
import { VALIDATION_OUTCOME } from "@blikka/validation"
import type { Topic } from "@blikka/db"

interface StaffPhotoListProps {
  photos: ParticipantSelectedPhoto[]
  expectedCount: number
  topics: Topic[]
  photoValidationMap: Map<string, ValidationResult[]>
  isBusy: boolean
  onRemove: (photoId: string) => void
}

type PhotoStatus = "ok" | "warning" | "error"

function getPhotoStatus(validations: ValidationResult[]): PhotoStatus {
  const hasError = validations.some(
    (r) => r.outcome === VALIDATION_OUTCOME.FAILED && r.severity === "error",
  )
  if (hasError) return "error"

  const hasWarning = validations.some(
    (r) => r.outcome === VALIDATION_OUTCOME.FAILED && r.severity === "warning",
  )
  if (hasWarning) return "warning"

  return "ok"
}

const STATUS_BORDER: Record<PhotoStatus, string> = {
  ok: "border-border",
  warning: "border-amber-300",
  error: "border-rose-300",
}

const STATUS_LABEL: Record<PhotoStatus, { text: string; className: string } | null> = {
  ok: null,
  warning: { text: "Warning", className: "text-amber-600 bg-amber-50 border-amber-200" },
  error: { text: "Issue found", className: "text-rose-600 bg-rose-50 border-rose-200" },
}

function resolveTopicName(orderIndex: number, topics: Topic[]): string | null {
  const topic = topics.find((t) => t.orderIndex === orderIndex)
  return topic?.name ?? null
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatCaptureDate(date: Date): string | null {
  try {
    if (Number.isNaN(date.getTime())) return null
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const d = String(date.getDate()).padStart(2, "0")
    const h = String(date.getHours()).padStart(2, "0")
    const min = String(date.getMinutes()).padStart(2, "0")
    return `${y}-${m}-${d} ${h}:${min}`
  } catch {
    return null
  }
}

export function StaffPhotoList({
  photos,
  expectedCount,
  topics,
  photoValidationMap,
  isBusy,
  onRemove,
}: StaffPhotoListProps) {
  if (photos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          No photos selected yet. Use the area above to add photos.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Selected Photos</p>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
          {photos.length} / {expectedCount}
        </span>
      </div>

      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {photos.map((photo) => {
            const validations = photoValidationMap.get(photo.id) ?? []
            const status = getPhotoStatus(validations)
            const topicName = resolveTopicName(photo.orderIndex, topics)
            const statusLabel = STATUS_LABEL[status]
            const captureDate = getExifDate(photo.exif)
            const captureDateFormatted = captureDate ? formatCaptureDate(captureDate) : null

            return (
              <motion.div
                key={photo.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.15 }}
                className={cn(
                  "group flex items-start gap-4 rounded-xl border bg-card px-3 py-3",
                  STATUS_BORDER[status],
                )}
              >
                <div className="relative shrink-0 overflow-hidden rounded-lg bg-muted">
                  <img
                    src={photo.previewUrl}
                    alt={photo.file.name}
                    className="h-20 w-20 object-cover sm:h-24 sm:w-24"
                  />
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-0.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-foreground sm:text-lg">
                        #{photo.orderIndex + 1}
                        {topicName ? (
                          <span className="font-normal text-muted-foreground">
                            {" "}
                            &mdash; {topicName}
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {photo.file.name}
                      </p>
                    </div>

                    {!isBusy ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-rose-600"
                        onClick={() => onRemove(photo.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>

                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(photo.file.size)}
                    {captureDateFormatted ? (
                      <>
                        <span className="mx-1.5">&middot;</span>
                        Taken {captureDateFormatted}
                      </>
                    ) : null}
                  </p>

                  {statusLabel ? (
                    <span
                      className={cn(
                        "mt-0.5 inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        statusLabel.className,
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          status === "error" ? "bg-rose-500" : "bg-amber-500",
                        )}
                      />
                      {statusLabel.text}
                    </span>
                  ) : null}
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
