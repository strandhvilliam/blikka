"use client"

import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react"
import { useTranslations } from "next-intl"
import { AnimatePresence, motion } from "motion/react"
import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { useLoopingText } from "@/hooks/use-looping-text"
import { Button } from "@/components/ui/button"
import { getUploadSummaryPresentation } from "@/lib/flow/upload-error-presenter"
import type { FinalizationState, UploadFileState } from "@/lib/flow/types"
import { FINALIZATION_STATE, UPLOAD_PHASE } from "@/lib/flow/types"

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

type ByCameraProgressUploadPhaseStatus = "active" | "completed" | "error"

type ByCameraProgressProcessingPhaseStatus = "pending" | "active" | "completed" | "error"

function useUploadPhaseCounts(files: UploadFileState[], expectedCount: number) {
  return useMemo(() => {
    const completed = files.filter((f) => f.phase === UPLOAD_PHASE.UPLOADED).length
    const failed = files.filter((f) => f.phase === UPLOAD_PHASE.ERROR).length
    const allUploadsComplete = completed === expectedCount
    return { completed, failed, allUploadsComplete }
  }, [files, expectedCount])
}

function ByCameraProgressHeading({
  files,
  expectedCount,
}: {
  files: UploadFileState[]
  expectedCount: number
}) {
  const t = useTranslations("FlowPage.uploadProgress")
  const { allUploadsComplete } = useUploadPhaseCounts(files, expectedCount)

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
      <h2 className="font-gothic text-3xl font-medium tracking-tight text-foreground">
        {allUploadsComplete ? t("byCameraTitleProcessing") : t("byCameraTitleUploading")}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {allUploadsComplete ? t("byCameraSubtitleProcessing") : t("byCameraSubtitleUploading")}
      </p>
    </motion.div>
  )
}

function ByCameraProgressKeepOpenHint({
  files,
  expectedCount,
}: {
  files: UploadFileState[]
  expectedCount: number
}) {
  const t = useTranslations("FlowPage.uploadProgress")
  const { allUploadsComplete } = useUploadPhaseCounts(files, expectedCount)

  if (!allUploadsComplete) return null

  return (
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="text-center text-xs text-muted-foreground"
    >
      {t("keepPageOpen")}
    </motion.p>
  )
}

function ByCameraProgressFailureSummary({ files }: { files: UploadFileState[] }) {
  const t = useTranslations("FlowPage.uploadProgress")
  const presentation = useMemo(() => getUploadSummaryPresentation(files), [files])

  if (!presentation) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4"
    >
      <p className="text-sm font-semibold text-destructive">{t(presentation.titleKey)}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t(presentation.bodyKey)}</p>
      {presentation.actionKey && (
        <p className="mt-1 text-sm text-muted-foreground">{t(presentation.actionKey)}</p>
      )}
    </motion.div>
  )
}

interface ByCameraProgressUploadPhaseProps {
  files: UploadFileState[]
  expectedCount: number
  onRetry?: () => void
}

function ByCameraProgressUploadPhase({
  files,
  expectedCount,
  onRetry,
}: ByCameraProgressUploadPhaseProps) {
  const t = useTranslations("FlowPage.uploadProgress")
  const { allUploadsComplete, failed } = useUploadPhaseCounts(files, expectedCount)
  const uploadSummary = useMemo(() => getUploadSummaryPresentation(files), [files])

  const hasFailures = failed > 0
  const status: ByCameraProgressUploadPhaseStatus = hasFailures
    ? "error"
    : allUploadsComplete
      ? "completed"
      : "active"

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        "overflow-hidden rounded-2xl border-2 p-5 transition-colors duration-300",
        status === "active" && "border-foreground/20 bg-white",
        status === "completed" && "border-border bg-muted/20",
        status === "error" && "border-destructive/40 bg-destructive/5",
      )}
    >
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foreground/6">
          {status === "active" && <Loader2 className="h-5 w-5 animate-spin text-foreground/60" />}
          {status === "completed" && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          {status === "error" && <AlertTriangle className="h-5 w-5 text-destructive" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {t("byCameraStep1Label")}
          </p>
          <h3 className="text-base font-semibold text-foreground">{t("byCameraStep1Heading")}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {status === "active" && t("byCameraStep1StatusActive")}
            {status === "completed" && t("byCameraStep1StatusComplete")}
            {status === "error" && t("byCameraStep1StatusError")}
          </p>
        </div>
      </div>

      {status === "error" && onRetry && uploadSummary?.retriable !== false && (
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
  )
}

interface ByCameraProgressProcessingPhaseProps {
  files: UploadFileState[]
  expectedCount: number
  finalizationState: FinalizationState
  participantReference?: string
}

function ByCameraProgressProcessingPhase({
  files,
  expectedCount,
  finalizationState,
  participantReference,
}: ByCameraProgressProcessingPhaseProps) {
  const t = useTranslations("FlowPage.uploadProgress")
  const finalizingT = useTranslations("FlowPage.uploadFinalizing")
  const processingTexts = useMemo(() => BY_CAMERA_PROCESSING_MESSAGE_KEYS.map((key) => t(key)), [t])
  const loopingText = useLoopingText(processingTexts, 2500)

  const { allUploadsComplete } = useUploadPhaseCounts(files, expectedCount)
  const isFinalizing =
    allUploadsComplete &&
    (finalizationState === FINALIZATION_STATE.FINALIZING ||
      finalizationState === FINALIZATION_STATE.READY)
  const isTimedOut = allUploadsComplete && finalizationState === FINALIZATION_STATE.TIMEOUT_BLOCKED

  const status: ByCameraProgressProcessingPhaseStatus = isTimedOut
    ? "error"
    : finalizationState === FINALIZATION_STATE.READY
      ? "completed"
      : isFinalizing
        ? "active"
        : "pending"

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.1 }}
      className={cn(
        "overflow-hidden rounded-2xl border-2 p-5 transition-colors duration-300",
        status === "active" && "border-foreground/20 bg-white",
        status === "completed" && "border-foreground/20 bg-white",
        status === "error" && "border-amber-300 bg-amber-50",
        status === "pending" && "border-border bg-transparent opacity-40",
      )}
    >
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foreground/6">
          {status === "pending" && (
            <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
          )}
          {status === "active" && <Loader2 className="h-5 w-5 animate-spin text-foreground/60" />}
          {status === "completed" && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          {status === "error" && <AlertTriangle className="h-5 w-5 text-amber-600" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {t("byCameraStep2Label")}
          </p>
          <h3 className="text-base font-semibold text-foreground">{t("byCameraStep2Heading")}</h3>
          <div className="relative mt-0.5 h-4 overflow-hidden text-xs text-muted-foreground">
            <AnimatePresence mode="popLayout">
              {status === "pending" && (
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
              {status === "active" && (
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
              {status === "completed" && (
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
              {status === "error" && (
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

      {status === "error" && (
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
  )
}

export function ByCameraUploadProgress({
  files,
  expectedCount,
  onRetry,
  finalizationState,
  participantReference,
}: ByCameraUploadProgressProps) {
  return (
    <div className="flex min-h-[60dvh] w-full flex-col items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <ByCameraProgressHeading files={files} expectedCount={expectedCount} />

        <div className="space-y-3">
          <ByCameraProgressFailureSummary files={files} />
          <ByCameraProgressUploadPhase
            files={files}
            expectedCount={expectedCount}
            onRetry={onRetry}
          />
          <ByCameraProgressProcessingPhase
            files={files}
            expectedCount={expectedCount}
            finalizationState={finalizationState}
            participantReference={participantReference}
          />
        </div>

        <ByCameraProgressKeepOpenHint files={files} expectedCount={expectedCount} />
      </div>
    </div>
  )
}
