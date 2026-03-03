"use client";

import { cn } from "@/lib/utils";
import type { Topic } from "@blikka/db";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  Upload,
} from "lucide-react";
import { motion } from "motion/react";
import type { UploadFileState } from "../_lib/types";
import { UPLOAD_PHASE } from "../_lib/types";

interface FileProgressItemProps {
  file: UploadFileState;
  topic?: Topic;
}

export function FileProgressItem({ file, topic }: FileProgressItemProps) {
  const getStatusIcon = () => {
    switch (file.phase) {
      case UPLOAD_PHASE.COMPLETED:
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case UPLOAD_PHASE.ERROR:
        return <AlertCircle className="w-5 h-5 text-destructive" />;
      case UPLOAD_PHASE.UPLOADING:
        return <Upload className="w-5 h-5 text-primary animate-pulse" />;
      case UPLOAD_PHASE.PROCESSING:
        return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusText = () => {
    switch (file.phase) {
      case UPLOAD_PHASE.COMPLETED:
        return "Completed";
      case UPLOAD_PHASE.ERROR:
        return file.error?.message || "Error";
      case UPLOAD_PHASE.UPLOADING:
        return `Uploading... ${file.progress}%`;
      case UPLOAD_PHASE.PROCESSING:
        return "Processing...";
      default:
        return "Waiting...";
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
          : file.phase === UPLOAD_PHASE.COMPLETED
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
      </div>
      <div className="shrink-0">{getStatusIcon()}</div>
    </motion.div>
  );
}
