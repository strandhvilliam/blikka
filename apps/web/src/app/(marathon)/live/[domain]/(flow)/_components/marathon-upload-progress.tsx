"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Topic } from "@blikka/db";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { FileProgressItem } from "./file-progress-item";
import type { FinalizationState, UploadFileState } from "../_lib/types";
import { FINALIZATION_STATE, UPLOAD_PHASE } from "../_lib/types";

interface MarathonUploadProgressProps {
  files: UploadFileState[];
  topics: Topic[];
  expectedCount: number;
  onRetry?: () => void;
  finalizationState: FinalizationState;
  participantReference?: string;
}

export function MarathonUploadProgress({
  files,
  topics,
  expectedCount,
  onRetry,
  finalizationState,
  participantReference,
}: MarathonUploadProgressProps) {
  const t = useTranslations("FlowPage.uploadProgress");
  const finalizingT = useTranslations("FlowPage.uploadFinalizing");
  const [elapsedTime, setElapsedTime] = useState(0);

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
      percentage: total > 0 ? (completed / total) * 100 : 0,
    };
  }, [files, expectedCount]);

  const allUploadsComplete = progress.completed === expectedCount;

  useEffect(() => {
    if (allUploadsComplete) return;

    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [allUploadsComplete]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };
  const hasFailures = progress.failed > 0;
  const isFinalizing =
    allUploadsComplete &&
    (finalizationState === FINALIZATION_STATE.FINALIZING ||
      finalizationState === FINALIZATION_STATE.READY);
  const isTimedOut =
    allUploadsComplete &&
    finalizationState === FINALIZATION_STATE.TIMEOUT_BLOCKED;

  const getTitle = () => {
    if (isTimedOut) return finalizingT("timeoutTitle");
    if (isFinalizing) return finalizingT("title");
    if (allUploadsComplete) return t("titleUploaded");
    if (hasFailures) return t("titleIssues");
    return t("titleUploading");
  };

  const getDescription = () => {
    if (isTimedOut) return finalizingT("timeoutDescription");
    if (isFinalizing) return finalizingT("description");
    if (allUploadsComplete) return t("finishingSubmission");
    if (hasFailures) return t("clickToRetry");
    return t("thisMayTakeSeveralMinutes");
  };

  return (
    <div className="w-full flex items-center justify-center min-h-[60dvh]">
      <Card className="w-full max-w-lg">
        <CardHeader className="pt-6">
          <div className="flex flex-col items-center text-center">
            {!allUploadsComplete && !hasFailures ? (
              <p className="mb-1 text-sm text-muted-foreground font-mono tabular-nums">
                {formatTime(elapsedTime)}
              </p>
            ) : null}
            <CardTitle className="text-xl font-semibold">
              {getTitle()}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              {getDescription()}
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{t("overallProgress")}</span>
              <span>
                {t("completedOfTotal", {
                  completed: progress.completed,
                  total: progress.total,
                })}
                {progress.failed > 0 && (
                  <span className="text-destructive ml-1">
                    ({progress.failed} {t("failed")})
                  </span>
                )}
              </span>
            </div>
            <Progress value={progress.percentage} />
          </div>

          {hasFailures && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg"
            >
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-destructive">
                  {progress.failed === 1
                    ? t("oneFileFailed")
                    : t("multipleFilesFailed", { count: progress.failed })}
                </p>
                <p className="text-muted-foreground">{t("checkConnection")}</p>
              </div>
            </motion.div>
          )}

          {isFinalizing && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 rounded-lg border border-primary/15 bg-primary/5 p-4"
            >
              <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-primary" />
              <div className="space-y-1 text-sm">
                <p className="font-medium text-foreground">
                  {finalizingT("receivedTitle")}
                </p>
                <p className="text-muted-foreground">
                  {finalizingT("waitNote")}
                </p>
                {participantReference ? (
                  <p className="font-mono text-foreground">
                    {finalizingT("participantNumber")}: {participantReference}
                  </p>
                ) : null}
              </div>
            </motion.div>
          )}

          {isTimedOut && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm"
            >
              <p className="font-medium text-amber-950">
                {finalizingT("doNotUploadAgain")}
              </p>
              <p className="mt-1 text-amber-900">
                {finalizingT("staffHelp")}
              </p>
              {participantReference ? (
                <p className="mt-3 font-mono text-amber-950">
                  {finalizingT("participantNumber")}: {participantReference}
                </p>
              ) : null}
              <p className="mt-3 text-xs text-amber-800">
                {finalizingT("autoContinue")}
              </p>
            </motion.div>
          )}

          <div className="space-y-2 max-h-64 overflow-y-auto">
            <AnimatePresence mode="popLayout">
              {files.length > 0
                ? files.map((file) => (
                    <FileProgressItem
                      key={file.key}
                      file={file}
                      topic={topics.find(
                        (t) => t.orderIndex === file.orderIndex,
                      )}
                    />
                  ))
                : Array.from({ length: expectedCount }, (_, index) => (
                    <motion.div
                      key={`placeholder-${index}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex-1 mr-3">
                        <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                      </div>
                      <div className="w-5 h-5 bg-muted rounded-full animate-pulse" />
                    </motion.div>
                  ))}
            </AnimatePresence>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 pb-6">
          {hasFailures && onRetry && !allUploadsComplete && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full"
            >
              <Button onClick={onRetry} variant="outline" className="w-full">
                <RefreshCw className="w-4 h-4 mr-2" />
                {t("retryFailed", { count: progress.failed })}
              </Button>
            </motion.div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
