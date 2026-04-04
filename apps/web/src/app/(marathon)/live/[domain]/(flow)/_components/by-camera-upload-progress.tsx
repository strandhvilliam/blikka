"use client"

import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react"
import { useTranslations } from "next-intl"
import { AnimatePresence, motion } from "motion/react"
import { useEffect, useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { getUploadSummaryPresentation } from "../_lib/upload-error-presenter"
import type { FinalizationState, UploadFileState } from "../_lib/types"
import { FINALIZATION_STATE, UPLOAD_PHASE } from "../_lib/types"

interface ByCameraUploadProgressProps {
  files: UploadFileState[]
  expectedCount: number
  onRetry?: () => void
  finalizationState: FinalizationState
  participantReference?: string
}

const BY_CAMERA_PROCESSING_MESSAGE_KEYS = [
  "byCameraProcessingValidating",
  "byCameraProcessingContactSheet",
  "byCameraProcessingMesmerizing",
  "byCameraProcessingAdmiring",
  "byCameraProcessingThumbnail",
] as const

function useLoopingText(texts: string[], intervalMs = 2000) {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % texts.length)
    }, intervalMs)
    return () => clearInterval(interval)
  }, [texts, intervalMs])
  return texts[index]
}

export function ByCameraUploadProgress({
  files,
  expectedCount,
  onRetry,
  finalizationState,
  participantReference,
}: ByCameraUploadProgressProps) {
  const t = useTranslations("FlowPage.uploadProgress")
  const finalizingT = useTranslations("FlowPage.uploadFinalizing")
  const processingTexts = useMemo(
    () => BY_CAMERA_PROCESSING_MESSAGE_KEYS.map((key) => t(key)),
    [t],
  )
  const loopingText = useLoopingText(processingTexts, 2500)

  const progress = useMemo(() => {
    const total = files.length || expectedCount
    const completed = files.filter((f) => f.phase === UPLOAD_PHASE.UPLOADED).length
    const failed = files.filter((f) => f.phase === UPLOAD_PHASE.ERROR).length
    return { total, completed, failed }
  }, [files, expectedCount])
  const uploadSummary = useMemo(() => getUploadSummaryPresentation(files), [files])

  const allUploadsComplete = progress.completed === expectedCount
  const hasFailures = progress.failed > 0
  const isFinalizing =
    allUploadsComplete &&
    (finalizationState === FINALIZATION_STATE.FINALIZING ||
      finalizationState === FINALIZATION_STATE.READY)
  const isTimedOut =
    allUploadsComplete && finalizationState === FINALIZATION_STATE.TIMEOUT_BLOCKED

  const step1Status = hasFailures ? "error" : allUploadsComplete ? "completed" : "active"
  const step2Status = isTimedOut
    ? "error"
    : finalizationState === FINALIZATION_STATE.READY
      ? "completed"
      : isFinalizing
        ? "active"
        : "pending"

  return (
    <div className="flex min-h-[60dvh] w-full flex-col items-center justify-center px-6">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <h2 className="font-gothic text-3xl font-medium tracking-tight text-foreground">
            {allUploadsComplete ? t("byCameraTitleProcessing") : t("byCameraTitleUploading")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {allUploadsComplete
              ? t("byCameraSubtitleProcessing")
              : t("byCameraSubtitleUploading")}
          </p>
        </motion.div>

        {/* Steps */}
        <div className="space-y-3">
          {hasFailures && uploadSummary && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4"
            >
              <p className="text-sm font-semibold text-destructive">
                {t(uploadSummary.titleKey)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{t(uploadSummary.bodyKey)}</p>
              {uploadSummary.actionKey && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(uploadSummary.actionKey)}
                </p>
              )}
            </motion.div>
          )}

          {/* Step 1: Upload */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={cn(
              "overflow-hidden rounded-2xl border-2 p-5 transition-colors duration-300",
              step1Status === "active" && "border-foreground/20 bg-white",
              step1Status === "completed" && "border-border bg-muted/20",
              step1Status === "error" && "border-destructive/40 bg-destructive/5",
            )}
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foreground/6">
                {step1Status === "active" && (
                  <Loader2 className="h-5 w-5 animate-spin text-foreground/60" />
                )}
                {step1Status === "completed" && (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                )}
                {step1Status === "error" && (
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {t("byCameraStep1Label")}
                </p>
                <h3 className="text-base font-semibold text-foreground">{t("byCameraStep1Heading")}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {step1Status === "active" && t("byCameraStep1StatusActive")}
                  {step1Status === "completed" && t("byCameraStep1StatusComplete")}
                  {step1Status === "error" && t("byCameraStep1StatusError")}
                </p>
              </div>
            </div>

            {step1Status === "error" && onRetry && uploadSummary?.retriable !== false && (
              <div className="mt-4 border-t border-dashed border-destructive/20 pt-4">
                <Button
                  onClick={onRetry}
                  variant="outline"
                  size="sm"
                  className="w-full rounded-full border-destructive/50 hover:bg-destructive/10"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t(uploadSummary?.retryLabelKey ?? "retry")}
                </Button>
              </div>
            )}
          </motion.div>

          {/* Step 2: Processing */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className={cn(
              "overflow-hidden rounded-2xl border-2 p-5 transition-colors duration-300",
              step2Status === "active" && "border-foreground/20 bg-white",
              step2Status === "completed" && "border-foreground/20 bg-white",
              step2Status === "error" && "border-amber-300 bg-amber-50",
              step2Status === "pending" && "border-border bg-transparent opacity-40",
            )}
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foreground/6">
                {step2Status === "pending" && (
                  <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                )}
                {step2Status === "active" && (
                  <Loader2 className="h-5 w-5 animate-spin text-foreground/60" />
                )}
                {step2Status === "completed" && (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                )}
                {step2Status === "error" && (
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {t("byCameraStep2Label")}
                </p>
                <h3 className="text-base font-semibold text-foreground">{t("byCameraStep2Heading")}</h3>
                <div className="relative mt-0.5 h-4 overflow-hidden text-xs text-muted-foreground">
                  <AnimatePresence mode="popLayout">
                    {step2Status === "pending" && (
                      <motion.span
                        key="pending"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0"
                      >
                        {t("byCameraStep2StatusPending")}
                      </motion.span>
                    )}
                    {step2Status === "active" && (
                      <motion.span
                        key={loopingText}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 truncate"
                      >
                        {loopingText}
                      </motion.span>
                    )}
                    {step2Status === "completed" && (
                      <motion.span
                        key="completed"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 font-medium text-emerald-600"
                      >
                        {t("byCameraStep2StatusReady")}
                      </motion.span>
                    )}
                    {step2Status === "error" && (
                      <motion.span
                        key="error"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 text-amber-700"
                      >
                        {t("byCameraStep2StatusSlow")}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {step2Status === "error" && (
              <div className="mt-4 border-t border-dashed border-amber-200 pt-4">
                <p className="text-xs text-amber-900">{finalizingT("doNotUploadAgain")}</p>
                {participantReference && (
                  <p className="mt-2 rounded-xl bg-amber-100/50 p-2.5 font-mono text-sm font-bold tracking-wider text-amber-950">
                    {t("byCameraParticipantRef", { ref: participantReference })}
                  </p>
                )}
              </div>
            )}
          </motion.div>
        </div>

        {/* Keep page open notice */}
        {allUploadsComplete && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-xs text-muted-foreground"
          >
            {t("keepPageOpen")}
          </motion.p>
        )}
      </div>
    </div>
  )
}
