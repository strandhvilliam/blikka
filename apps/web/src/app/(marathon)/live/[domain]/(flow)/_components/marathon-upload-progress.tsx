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
import { AlertTriangle, Check, Loader2, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FileProgressItem } from "./file-progress-item";
import type { UploadFileState } from "../_lib/types";
import { UPLOAD_PHASE } from "../_lib/types";

interface MarathonUploadProgressProps {
  files: UploadFileState[];
  topics: Topic[];
  expectedCount: number;
  onRetry?: () => void;
  participantReference?: string;
}

export function MarathonUploadProgress({
  files,
  topics,
  expectedCount,
  onRetry,
  participantReference,
}: MarathonUploadProgressProps) {
  const t = useTranslations("FlowPage.uploadProgress");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [minTimeReached, setMinTimeReached] = useState(false);
  const mountedAt = useRef(0);

  useEffect(() => {
    mountedAt.current = Date.now();
  }, []);

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

  const rawUploadsComplete = progress.completed === expectedCount;
  const hasFailures = progress.failed > 0;

  const MIN_UPLOAD_PHASE_DISPLAY_MS = 2000;

  useEffect(() => {
    if (!rawUploadsComplete) return;

    const elapsed = Date.now() - mountedAt.current;
    const remaining = Math.max(0, MIN_UPLOAD_PHASE_DISPLAY_MS - elapsed);

    const timeout = window.setTimeout(() => setMinTimeReached(true), remaining);
    return () => window.clearTimeout(timeout);
  }, [rawUploadsComplete]);

  const allUploadsComplete = rawUploadsComplete && minTimeReached;

  useEffect(() => {
    if (rawUploadsComplete) return;

    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [rawUploadsComplete]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="w-full flex items-center justify-center min-h-[60dvh]">
      <Card className="w-full max-w-lg">
        <CardHeader className="pt-6">
          <div className="flex flex-col items-center text-center">
            {!allUploadsComplete && !hasFailures && (
              <p className="mb-1 text-sm text-muted-foreground font-mono tabular-nums">
                {formatTime(elapsedTime)}
              </p>
            )}

            {allUploadsComplete && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 mb-3"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground">
                    <Check className="h-3 w-3 text-background" strokeWidth={3} />
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-foreground">
                    {t("stepUploaded")}
                  </span>
                </div>
                <div className="h-px w-5 bg-border" />
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-foreground/20">
                    <Loader2 className="h-3 w-3 animate-spin text-foreground/50" />
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {t("stepFinalizing")}
                  </span>
                </div>
              </motion.div>
            )}

            <CardTitle className="text-xl font-semibold">
              {allUploadsComplete
                ? t("titleReceived")
                : hasFailures
                  ? t("titleIssues")
                  : t("titleUploading")}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              {allUploadsComplete
                ? t("descriptionFinalizing")
                : hasFailures
                  ? t("clickToRetry")
                  : t("thisMayTakeSeveralMinutes")}
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {!allUploadsComplete && (
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
          )}

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

          {!allUploadsComplete && (
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
          )}

          {allUploadsComplete && participantReference && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-center"
            >
              <div className="px-5 py-3 rounded-lg border border-border bg-muted/30 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">
                  {t("participantNumber")}
                </p>
                <p className="text-xl font-mono font-bold text-foreground tracking-widest">
                  {participantReference}
                </p>
              </div>
            </motion.div>
          )}
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

          {allUploadsComplete && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-muted-foreground text-center"
            >
              {t("keepPageOpen")}
            </motion.p>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
