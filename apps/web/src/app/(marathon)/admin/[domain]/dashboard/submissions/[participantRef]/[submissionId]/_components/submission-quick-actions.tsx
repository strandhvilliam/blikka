"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { Submission, ValidationResult } from "@blikka/db"
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  FileCode,
  RefreshCw,
  ReplaceIcon,
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

interface SubmissionQuickActionsProps {
  submission: Submission
  validationResults: ValidationResult[]
  onShowExif: () => void
  onShowValidation: () => void
  showExifPanel: boolean
  showValidationPanel: boolean
  marathonMode?: string
  participantId?: number
  participantStatus?: string
  participantRef: string
}

export function SubmissionQuickActions({
  submission,
  validationResults,
  onShowExif,
  onShowValidation,
  showExifPanel,
  showValidationPanel,
  marathonMode,
  participantId,
  participantStatus,
  participantRef,
}: SubmissionQuickActionsProps) {
  const hasExif = submission.exif && Object.keys(submission.exif).length > 0
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

  return (
    <Card className="p-3">
      <div className="flex flex-wrap gap-2.5 items-center justify-between">
        {/* Primary Actions */}
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
            disabled={rerunValidationsMutation.isPending}
          >
            <RefreshCw
              className={`h-4 w-4 ${rerunValidationsMutation.isPending ? "animate-spin" : ""}`}
            />
            Rerun Validations
          </Button>
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
              <Badge variant="secondary" className="bg-blue-500/20 text-blue-600 ml-1">
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
  )
}
