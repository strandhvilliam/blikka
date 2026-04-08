"use client";

import { cn } from "@/lib/utils";
import type { Topic } from "@blikka/db";
import { AlertCircle, CheckCircle, Clock, Upload } from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { getUploadErrorPresentation } from "@/lib/flow/upload-error-presenter";
import type { UploadFileState } from "@/lib/flow/types";
import { UPLOAD_PHASE } from "@/lib/flow/types";

interface FileProgressItemProps {
  file: UploadFileState;
  topic?: Topic;
}

export function FileProgressItem({ file, topic }: FileProgressItemProps) {
  const t = useTranslations("FlowPage.uploadProgress");
  const errorPresentation = file.error
    ? getUploadErrorPresentation(file.error)
    : null;

  const getStatusIcon = () => {
    switch (file.phase) {
      case UPLOAD_PHASE.UPLOADED:
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case UPLOAD_PHASE.ERROR:
        return <AlertCircle className="w-5 h-5 text-destructive" />;
      case UPLOAD_PHASE.UPLOADING:
        return <Upload className="w-5 h-5 animate-pulse text-primary" />;
      default:
        return <Clock className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusText = () => {
    switch (file.phase) {
      case UPLOAD_PHASE.UPLOADED:
        return t("statusUploaded");
      case UPLOAD_PHASE.ERROR:
        return errorPresentation ? t(errorPresentation.titleKey) : t("statusError");
      case UPLOAD_PHASE.UPLOADING:
        return t("statusUploading");
      default:
        return t("statusWaiting");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "flex items-center justify-between p-3 rounded-lg",
        file.phase === UPLOAD_PHASE.ERROR
          ? "bg-destructive/10"
          : file.phase === UPLOAD_PHASE.UPLOADED
            ? "bg-green-50 dark:bg-green-950/20"
            : "bg-muted/50",
      )}
    >
      <div className="flex-1 min-w-0 mr-3">
        <p className="font-medium text-sm truncate">
          {topic?.name || `Photo ${file.orderIndex + 1}`}
        </p>
        <p
          className={cn(
            "text-xs",
            file.phase === UPLOAD_PHASE.ERROR
              ? "text-destructive"
              : "text-muted-foreground",
          )}
        >
          {getStatusText()}
        </p>
        {file.phase === UPLOAD_PHASE.ERROR && errorPresentation && (
          <>
            <p className="mt-1 text-xs text-muted-foreground">
              {t(errorPresentation.bodyKey)}
            </p>
            {errorPresentation.actionKey && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t(errorPresentation.actionKey)}
              </p>
            )}
            {errorPresentation.technicalDetails && (
              <details className="mt-2 text-xs text-muted-foreground">
                <summary className="cursor-pointer select-none font-medium">
                  {t("technicalDetails")}
                </summary>
                <div className="mt-2 space-y-1 rounded-md border border-border/70 bg-background/60 p-2">
                  {errorPresentation.technicalDetails.awsCode && (
                    <p>
                      {t("awsCode")}: {errorPresentation.technicalDetails.awsCode}
                    </p>
                  )}
                  {errorPresentation.technicalDetails.awsRequestId && (
                    <p>
                      {t("requestId")}: {errorPresentation.technicalDetails.awsRequestId}
                    </p>
                  )}
                  {errorPresentation.technicalDetails.httpStatus && (
                    <p>
                      {t("statusCode")}: {errorPresentation.technicalDetails.httpStatus}
                    </p>
                  )}
                </div>
              </details>
            )}
          </>
        )}
      </div>
      <div className="shrink-0">{getStatusIcon()}</div>
    </motion.div>
  );
}
