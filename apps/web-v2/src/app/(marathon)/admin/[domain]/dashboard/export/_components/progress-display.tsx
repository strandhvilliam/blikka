"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle, Loader2, XCircle } from "lucide-react";
import type { ProgressData } from "./full-marathon-zip.types";

interface ProgressDisplayProps {
  progress: ProgressData;
  percentage: number;
}

export function ProgressDisplay({
  progress,
  percentage,
}: ProgressDisplayProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          {progress.status === "processing" ||
          progress.status === "initializing" ? (
            <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
          ) : progress.status === "completed" ? (
            <CheckCircle className="h-4 w-4 text-emerald-600" />
          ) : progress.status === "cancelled" ? (
            <XCircle className="h-4 w-4 text-muted-foreground" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-red-600" />
          )}
          <span className="capitalize">{progress.status}</span>
        </div>
        <span className="text-muted-foreground">{percentage}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full transition-all duration-300",
            progress.status === "failed"
              ? "bg-red-500"
              : progress.status === "cancelled"
                ? "bg-muted-foreground"
                : "bg-violet-600",
          )}
          style={{ width: percentage + "%" }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {progress.completedChunks.toLocaleString()} /{" "}
          {progress.totalChunks.toLocaleString()} chunks
        </span>
        {progress.failedChunks > 0 && (
          <span className="text-red-600">
            {progress.failedChunks.toLocaleString()} failed
          </span>
        )}
      </div>
      {progress.competitionClasses.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {progress.competitionClasses.map((cc) => (
            <Badge
              key={cc.competitionClassName}
              variant="secondary"
              className="text-xs"
            >
              {cc.competitionClassName}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
