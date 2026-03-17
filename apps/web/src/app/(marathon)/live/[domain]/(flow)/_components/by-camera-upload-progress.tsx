"use client";

import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { FinalizationState, UploadFileState } from "../_lib/types";
import { FINALIZATION_STATE, UPLOAD_PHASE } from "../_lib/types";

interface ByCameraUploadProgressProps {
  files: UploadFileState[];
  expectedCount: number;
  onRetry?: () => void;
  finalizationState: FinalizationState;
  participantReference?: string;
}

const PROCESSING_TEXTS = [
  "Validating...",
  "Creating Contact Sheet...",
  "Mesmerizing...",
  "Admiring...",
  "Making thumbnail...",
];

function useLoopingText(texts: string[], intervalMs = 2000) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % texts.length);
    }, intervalMs);
    return () => clearInterval(interval);
  }, [texts, intervalMs]);
  return texts[index];
}

export function ByCameraUploadProgress({
  files,
  expectedCount,
  onRetry,
  finalizationState,
  participantReference,
}: ByCameraUploadProgressProps) {
  const t = useTranslations("FlowPage.uploadProgress");
  const finalizingT = useTranslations("FlowPage.uploadFinalizing");
  const loopingText = useLoopingText(PROCESSING_TEXTS, 2500);

  const progress = useMemo(() => {
    const total = files.length || expectedCount;
    const completed = files.filter(
      (f) => f.phase === UPLOAD_PHASE.UPLOADED,
    ).length;
    const failed = files.filter((f) => f.phase === UPLOAD_PHASE.ERROR).length;

    return {
      total,
      completed,
      failed,
    };
  }, [files, expectedCount]);

  const allUploadsComplete = progress.completed === expectedCount;
  const hasFailures = progress.failed > 0;
  const isFinalizing =
    allUploadsComplete &&
    (finalizationState === FINALIZATION_STATE.FINALIZING ||
      finalizationState === FINALIZATION_STATE.READY);
  const isTimedOut =
    allUploadsComplete &&
    finalizationState === FINALIZATION_STATE.TIMEOUT_BLOCKED;

  // Step 1: Uploading to Cloud
  const step1Status = hasFailures
    ? "error"
    : allUploadsComplete
      ? "completed"
      : "active";

  // Step 2: Processing
  const step2Status = isTimedOut
    ? "error"
    : finalizationState === FINALIZATION_STATE.READY
      ? "completed"
      : isFinalizing
        ? "active"
        : "pending";

  return (
    <div className="w-full flex flex-col items-center justify-center min-h-[60dvh] px-4 font-sans">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            {allUploadsComplete ? "Processing Photo" : "Uploading Photo"}
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            {allUploadsComplete
              ? "Your photo is safe in the cloud. We are now preparing it."
              : "Please keep the app open while we upload your photo."}
          </p>
        </div>

        <div className="space-y-4">
          {/* Step 1 Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative overflow-hidden border-2 rounded-xl p-5 transition-colors duration-300 ${
              step1Status === "active"
                ? "border-primary bg-primary/5"
                : step1Status === "completed"
                  ? "border-muted bg-muted/20"
                  : "border-destructive bg-destructive/5"
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="shrink-0">
                {step1Status === "active" && (
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                )}
                {step1Status === "completed" && (
                  <CheckCircle2 className="w-6 h-6 text-primary" />
                )}
                {step1Status === "error" && (
                  <AlertTriangle className="w-6 h-6 text-destructive" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base">
                  1. Uploading to Cloud
                </h3>
                <p className="text-sm text-muted-foreground truncate">
                  {step1Status === "active" && "Transferring securely..."}
                  {step1Status === "completed" && "Safe and soundly uploaded"}
                  {step1Status === "error" && "Upload failed"}
                </p>
              </div>
            </div>

            {step1Status === "error" && onRetry && (
              <div className="mt-4 pt-4 border-t border-destructive/20">
                <Button
                  onClick={onRetry}
                  variant="outline"
                  size="sm"
                  className="w-full border-destructive/50 hover:bg-destructive/10"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry Upload
                </Button>
              </div>
            )}
          </motion.div>

          {/* Step 2 Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`relative overflow-hidden border-2 rounded-xl p-5 transition-colors duration-300 ${
              step2Status === "active"
                ? "border-primary bg-primary/5"
                : step2Status === "completed"
                  ? "border-primary bg-primary/5"
                  : step2Status === "error"
                    ? "border-amber-500 bg-amber-50"
                    : "border-muted bg-transparent opacity-50"
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="shrink-0">
                {step2Status === "pending" && (
                  <div className="w-6 h-6 rounded-full border-2 border-muted" />
                )}
                {step2Status === "active" && (
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                )}
                {step2Status === "completed" && (
                  <CheckCircle2 className="w-6 h-6 text-primary" />
                )}
                {step2Status === "error" && (
                  <AlertTriangle className="w-6 h-6 text-amber-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base">
                  2. Processing in Backend
                </h3>
                <div className="text-sm text-muted-foreground h-5 relative overflow-hidden">
                  <AnimatePresence mode="popLayout">
                    {step2Status === "pending" && (
                      <motion.span
                        key="pending"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute inset-0"
                      >
                        Waiting for upload...
                      </motion.span>
                    )}
                    {step2Status === "active" && (
                      <motion.span
                        key={loopingText}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute inset-0 truncate"
                      >
                        {loopingText}
                      </motion.span>
                    )}
                    {step2Status === "completed" && (
                      <motion.span
                        key="completed"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute inset-0 text-primary font-medium"
                      >
                        Ready!
                      </motion.span>
                    )}
                    {step2Status === "error" && (
                      <motion.span
                        key="error"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute inset-0 text-amber-700"
                      >
                        Taking longer than expected
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {step2Status === "error" && (
              <div className="mt-4 pt-4 border-t border-amber-200">
                <p className="text-sm text-amber-900">
                  {finalizingT("doNotUploadAgain")}
                </p>
                {participantReference && (
                  <p className="mt-2 font-mono text-sm text-amber-950 bg-amber-100/50 p-2 rounded">
                    Ref: {participantReference}
                  </p>
                )}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
