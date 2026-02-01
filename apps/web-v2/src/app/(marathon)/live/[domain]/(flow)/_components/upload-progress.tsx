"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PrimaryButton } from "@/components/ui/primary-button";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import type { Topic } from "@blikka/db";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { FileProgressItem } from "./file-progress-item";
import type { UploadFileState } from "../_lib/types";
import { UPLOAD_PHASE } from "../_lib/types";

interface UploadProgressProps {
  files: UploadFileState[];
  topics: Topic[];
  expectedCount: number;
  onComplete?: () => void;
  onRetry?: () => void;
  isNavigating?: boolean;
}

export function UploadProgress({
  files,
  topics,
  expectedCount,
  onComplete,
  onRetry,
  isNavigating = false,
}: UploadProgressProps) {
  const t = useTranslations("FlowPage.uploadProgress");
  const [elapsedTime, setElapsedTime] = useState(0);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = useMemo(() => {
    const total = files.length || expectedCount;
    const completed = files.filter(
      (f) => f.phase === UPLOAD_PHASE.COMPLETED,
    ).length;
    const failed = files.filter((f) => f.phase === UPLOAD_PHASE.ERROR).length;
    const processing = files.filter(
      (f) => f.phase === UPLOAD_PHASE.PROCESSING,
    ).length;

    return {
      total,
      completed,
      failed,
      processing,
      percentage: total > 0 ? (completed / total) * 100 : 0,
    };
  }, [files, expectedCount]);

  const allUploadsComplete = progress.completed === expectedCount;
  const hasFailures = progress.failed > 0;

  const getTitle = () => {
    if (allUploadsComplete) return t("titleComplete");
    if (hasFailures) return t("titleIssues");
    return t("titleUploading");
  };

  const getDescription = () => {
    if (allUploadsComplete) return t("clickToContinue");
    if (hasFailures) return t("clickToRetry");
    return t("thisMayTakeSeveralMinutes");
  };

  return (
    <div className="w-full flex items-center justify-center min-h-[60dvh]">
      <Card className="w-full max-w-lg">
        <CardHeader className="pt-6">
          <div className="flex items-center justify-between">
            <div className="text-sm w-8 text-muted-foreground font-mono">
              {!hasFailures && formatTime(elapsedTime)}
            </div>
            <div className="flex flex-col items-center">
              <CardTitle className="text-xl font-semibold">
                {getTitle()}
              </CardTitle>
              <CardDescription>{getDescription()}</CardDescription>
            </div>
            <div className="w-8" />
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Progress bar */}
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

          {/* Error banner */}
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

          {/* File list */}
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
          {hasFailures && onRetry && (
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

          {allUploadsComplete && onComplete && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-[80%]"
            >
              <PrimaryButton
                onClick={onComplete}
                className="w-full text-lg rounded-full"
                disabled={isNavigating}
              >
                {isNavigating ? (
                  <>
                    <Spinner className="mr-2" />
                    {t("continue")}
                  </>
                ) : (
                  t("continue")
                )}
              </PrimaryButton>
            </motion.div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
