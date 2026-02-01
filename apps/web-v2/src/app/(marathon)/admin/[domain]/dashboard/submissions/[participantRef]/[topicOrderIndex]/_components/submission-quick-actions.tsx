"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Submission, ValidationResult } from "@blikka/db";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  FileCode,
  ReplaceIcon,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SubmissionQuickActionsProps {
  submission: Submission;
  validationResults: ValidationResult[];
  onShowExif: () => void;
  onShowValidation: () => void;
  showExifPanel: boolean;
  showValidationPanel: boolean;
  marathonMode?: string;
}

export function SubmissionQuickActions({
  submission,
  validationResults,
  onShowExif,
  onShowValidation,
  showExifPanel,
  showValidationPanel,
  marathonMode,
}: SubmissionQuickActionsProps) {
  const hasExif = submission.exif && Object.keys(submission.exif).length > 0;
  const hasValidation = validationResults.length > 0;
  const hasIssues = validationResults.some(
    (result) => result.outcome === "failed",
  );
  const isByCameraMode = marathonMode === "by-camera";

  return (
    <Card className="p-3">
      <div className="flex flex-wrap gap-2.5 items-center justify-between">
        {/* Primary Actions */}
        <div className="flex flex-wrap gap-2">
          {!isByCameraMode && (
            <>
              <Button variant="default" size="sm" className="gap-2">
                <ThumbsUp className="h-4 w-4" />
                Approve
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <ThumbsDown className="h-4 w-4" />
                Reject
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" className="gap-2">
            <ReplaceIcon className="h-4 w-4" />
            Replace
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Download
          </Button>
        </div>

        {/* Toggle Panels */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={showValidationPanel ? "secondary" : "outline"}
            size="sm"
            className="gap-2"
            onClick={onShowValidation}
          >
            <ShieldCheck className="h-4 w-4" />
            Validation
            {hasValidation && (
              <Badge
                variant="secondary"
                className={
                  hasIssues
                    ? "bg-destructive/20 text-destructive ml-1"
                    : "bg-green-500/20 text-green-600 ml-1"
                }
              >
                {validationResults.length}
              </Badge>
            )}
            {showValidationPanel ? (
              <ChevronUp className="h-3 w-3 ml-1" />
            ) : (
              <ChevronDown className="h-3 w-3 ml-1" />
            )}
          </Button>
          <Button
            variant={showExifPanel ? "secondary" : "outline"}
            size="sm"
            className="gap-2"
            onClick={onShowExif}
          >
            <FileCode className="h-4 w-4" />
            EXIF Data
            {hasExif && (
              <Badge
                variant="secondary"
                className="bg-blue-500/20 text-blue-600 ml-1"
              >
                {Object.keys(submission.exif || {}).length}
              </Badge>
            )}
            {showExifPanel ? (
              <ChevronUp className="h-3 w-3 ml-1" />
            ) : (
              <ChevronDown className="h-3 w-3 ml-1" />
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}
