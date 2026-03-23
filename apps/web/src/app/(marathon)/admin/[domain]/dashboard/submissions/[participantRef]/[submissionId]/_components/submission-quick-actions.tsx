"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { Submission, ValidationResult } from "@blikka/db"
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileCode,
  FileImage,
  RefreshCw,
  ShieldCheck,
  UserCheck,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useTRPC } from "@/lib/trpc/client"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useDomain } from "@/lib/domain-provider"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { downloadRemoteUrl } from "../_lib/download-remote-url"
import { SubmissionReplaceDialog } from "./submission-replace-dialog"

export type SubmissionDetailTab = "exif" | "validation"

interface SubmissionQuickActionsProps {
  submission: Submission
  validationResults: ValidationResult[]
  activeDetailTab: SubmissionDetailTab
  onDetailTabChange: (tab: SubmissionDetailTab) => void
  marathonMode?: string
  participantId?: number
  participantStatus?: string
  participantRef: string
  downloadUrl: string | null
  downloadFileName: string
}

export function SubmissionQuickActions({
  submission,
  validationResults,
  activeDetailTab,
  onDetailTabChange,
  marathonMode,
  participantId,
  participantStatus,
  participantRef,
  downloadUrl,
  downloadFileName,
}: SubmissionQuickActionsProps) {
  const hasExif = submission.exif && Object.keys(submission.exif).length > 0
  const hasThumbnail = Boolean(submission.thumbnailKey)
  const hasValidation = validationResults.length > 0
  const hasIssues = validationResults.some((result) => result.outcome === "failed")
  const isByCameraMode = marathonMode === "by-camera"
  const isMarathonMode = !isByCameraMode
  const isVerified = participantStatus === "verified"
  const domain = useDomain()
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const verifyMutation = useMutation(
    trpc.participants.verifyParticipant.mutationOptions({
      onSuccess: () => {
        toast.success("Participant verified successfully")
        queryClient.invalidateQueries({
          queryKey: trpc.participants.getByReference.queryKey({
            reference: participantRef,
            domain,
          }),
        })
      },
      onError: (error) => {
        toast.error(error.message || "Failed to verify participant")
      },
    }),
  )

  const rerunValidationsMutation = useMutation(
    trpc.validations.runValidations.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Validations rerun successfully (${data.resultsCount} results)`)
        queryClient.invalidateQueries({
          queryKey: trpc.participants.getByReference.queryKey({
            reference: participantRef,
            domain,
          }),
        })
        queryClient.invalidateQueries({
          queryKey: trpc.participants.getByDomainInfinite.pathKey(),
        })
      },
      onError: (error) => {
        toast.error(error.message || "Failed to rerun validations")
      },
    }),
  )

  const regenerateAssetsMutation = useMutation(
    trpc.submissions.regenerateSubmissionAssets.mutationOptions({
      onSuccess: async (data, variables) => {
        const actionLabel =
          variables.regenerateExif && variables.regenerateThumbnail
            ? "Submission assets refreshed"
            : variables.regenerateExif
              ? "EXIF regenerated"
              : variables.regenerateThumbnail
                ? "Thumbnail generated"
                : "Submission updated"

        toast.success(
          variables.rerunValidations
            ? `${actionLabel}. Validations reran with ${data.validationResultsCount} results.`
            : actionLabel,
        )

        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.participants.getByReference.queryKey({
              reference: participantRef,
              domain,
            }),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.participants.getByDomainInfinite.pathKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.validations.pathKey(),
          }),
        ])
      },
      onError: (error) => {
        toast.error(error.message || "Failed to refresh submission assets")
      },
    }),
  )
  const isRegeneratingExif =
    regenerateAssetsMutation.isPending && regenerateAssetsMutation.variables?.regenerateExif
  const isGeneratingThumbnail =
    regenerateAssetsMutation.isPending && regenerateAssetsMutation.variables?.regenerateThumbnail

  const handleVerify = () => {
    if (participantId) {
      verifyMutation.mutate({
        id: participantId,
        domain,
      })
    }
  }

  const handleRerunValidations = () => {
    rerunValidationsMutation.mutate({
      domain,
      reference: participantRef,
    })
  }

  const handleRegenerateExif = () => {
    regenerateAssetsMutation.mutate({
      domain,
      submissionId: submission.id,
      regenerateExif: true,
      regenerateThumbnail: false,
      rerunValidations: true,
    })
  }

  const handleGenerateThumbnail = () => {
    regenerateAssetsMutation.mutate({
      domain,
      submissionId: submission.id,
      regenerateExif: false,
      regenerateThumbnail: true,
      rerunValidations: false,
    })
  }

  const handleDownload = () => {
    if (!downloadUrl) {
      return
    }
    void downloadRemoteUrl(downloadUrl, downloadFileName)
  }

  return (
    <Card className="p-3">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2.5 items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {/* Verify button - only for marathon mode when not verified */}
            {isMarathonMode && !isVerified && participantId && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-2"
                    disabled={verifyMutation.isPending}
                  >
                    <UserCheck className="h-4 w-4" />
                    Verify
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Verify Participant</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to verify this participant? This will mark all their
                      submissions as verified and complete their registration.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleVerify} disabled={verifyMutation.isPending}>
                      {verifyMutation.isPending ? "Verifying..." : "Verify"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {/* Verified badge - shown when already verified */}
            {isMarathonMode && isVerified && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-green-600 border-green-200 bg-green-50/30"
                disabled
              >
                <CheckCircle2 className="h-4 w-4" />
                Verified
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleRerunValidations}
              disabled={rerunValidationsMutation.isPending || regenerateAssetsMutation.isPending}
            >
              <RefreshCw
                className={cn(
                  "h-4 w-4",
                  (rerunValidationsMutation.isPending || regenerateAssetsMutation.isPending) &&
                    "animate-spin",
                )}
              />
              Rerun Validations
            </Button>
            <SubmissionReplaceDialog submissionId={submission.id} participantRef={participantRef} />
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={!downloadUrl}
              onClick={handleDownload}
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>

          <div
            className="flex flex-wrap gap-0.5 rounded-lg bg-muted/60 p-1"
            role="tablist"
            aria-label="Submission technical details"
          >
            <Button
              type="button"
              role="tab"
              aria-selected={activeDetailTab === "exif"}
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 gap-2 rounded-md shadow-none",
                activeDetailTab === "exif"
                  ? "bg-white font-semibold text-foreground shadow-sm ring-1 ring-border/80 hover:bg-white"
                  : "text-muted-foreground hover:bg-transparent hover:text-foreground",
              )}
              onClick={() => onDetailTabChange("exif")}
            >
              <FileCode className="h-4 w-4" />
              EXIF Data
              {hasExif && (
                <Badge variant="secondary" className="bg-blue-500/20 text-blue-600 ml-1">
                  {Object.keys(submission.exif || {}).length}
                </Badge>
              )}
            </Button>
            <Button
              type="button"
              role="tab"
              aria-selected={activeDetailTab === "validation"}
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 gap-2 rounded-md shadow-none",
                activeDetailTab === "validation"
                  ? "bg-white font-semibold text-foreground shadow-sm ring-1 ring-border/80 hover:bg-white"
                  : "text-muted-foreground hover:bg-transparent hover:text-foreground",
              )}
              onClick={() => onDetailTabChange("validation")}
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
            </Button>
          </div>
        </div>

        {isByCameraMode && (!hasExif || !hasThumbnail) && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
                  <AlertCircle className="h-4 w-4" />
                  Submission recovery actions
                </div>
                <p className="text-xs text-amber-800/80">
                  {!hasExif && !hasThumbnail
                    ? "This submission is missing EXIF data and a thumbnail."
                    : !hasExif
                      ? "This submission is missing EXIF data."
                      : "This submission is missing a thumbnail."}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {!hasThumbnail && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
                    onClick={handleGenerateThumbnail}
                    disabled={regenerateAssetsMutation.isPending || rerunValidationsMutation.isPending}
                  >
                    <FileImage className="h-4 w-4" />
                    {isGeneratingThumbnail ? "Generating..." : "Generate thumbnail"}
                  </Button>
                )}
                {!hasExif && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
                    onClick={handleRegenerateExif}
                    disabled={regenerateAssetsMutation.isPending || rerunValidationsMutation.isPending}
                  >
                    <FileCode className="h-4 w-4" />
                    {isRegeneratingExif ? "Regenerating..." : "Regenerate EXIF + revalidate"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
