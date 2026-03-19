"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  CheckCircle2,
  Download,
  RefreshCw,
  ReplaceIcon,
  UserCheck,
} from "lucide-react"
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
  marathonMode?: string
  participantId?: number
  participantStatus?: string
  participantRef: string
}

export function SubmissionQuickActions({
  marathonMode,
  participantId,
  participantStatus,
  participantRef,
}: SubmissionQuickActionsProps) {
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
        toast.success(`Checks rerun successfully (${data.resultsCount} results)`)
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
        toast.error(error.message || "Failed to rerun checks")
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
    <Card className="border p-4 shadow-sm">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Actions
      </p>
      <div className="flex flex-wrap gap-2">
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
                Verify participant
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Verify participant</AlertDialogTitle>
                <AlertDialogDescription>
                  This marks all their submissions as verified and completes their registration.
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
        {isMarathonMode && isVerified && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-green-200 bg-green-50/30 text-green-700"
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
          Rerun checks
        </Button>
        <Button variant="outline" size="sm" className="gap-2">
          <ReplaceIcon className="h-4 w-4" />
          Replace photo
        </Button>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Download
        </Button>
      </div>
    </Card>
  )
}
