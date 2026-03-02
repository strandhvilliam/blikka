"use client"

import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, CheckCircle2, Loader2, Trash2, XCircle } from "lucide-react"
import { toast } from "sonner"
import type { Topic } from "@blikka/db"

import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PrimaryButton } from "@/components/ui/primary-button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import type { StaffParticipant } from "../_lib/staff-types"
import { DrawerLayout } from "./drawer-layout"
import { PreviewDialog } from "./preview-dialog"
import { ValidationAccordion } from "./validation-accordion"

interface ParticipantInfoDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  participant: StaffParticipant | null
  participantLoading: boolean
  topics: Topic[]
  currentStaffId: string
  readOnly?: boolean
  onParticipantVerified?: () => void
  onParticipantRejected?: () => void
}

export function ParticipantInfoDrawer({
  open,
  onOpenChange,
  participant,
  participantLoading,
  topics,
  currentStaffId,
  readOnly = false,
  onParticipantVerified,
  onParticipantRejected,
}: ParticipantInfoDrawerProps) {
  const domain = useDomain()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [confirmReference, setConfirmReference] = useState("")
  const [showRejectError, setShowRejectError] = useState(false)

  useEffect(() => {
    if (!rejectOpen) {
      setConfirmReference("")
      setShowRejectError(false)
    }
  }, [rejectOpen])

  const updateValidationResultMutation = useMutation(
    trpc.validations.updateValidationResult.mutationOptions({
      onError: () => {
        toast.error("Failed to overrule validation")
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: trpc.validations.pathKey() })
        queryClient.invalidateQueries({ queryKey: trpc.participants.pathKey() })
      },
    })
  )

  const verifyParticipantMutation = useMutation(
    trpc.validations.createParticipantVerification.mutationOptions({
      onSuccess: () => {
        toast.success("Participant verified")
        onOpenChange(false)
        onParticipantVerified?.()
      },
      onError: () => {
        toast.error("Failed to verify participant")
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: trpc.validations.pathKey() })
        queryClient.invalidateQueries({ queryKey: trpc.participants.pathKey() })
        queryClient.invalidateQueries({ queryKey: trpc.users.pathKey() })
      },
    })
  )

  const rejectParticipantMutation = useMutation(
    trpc.participants.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Participant rejected")
        setRejectOpen(false)
        onOpenChange(false)
        onParticipantRejected?.()
      },
      onError: () => {
        toast.error("Failed to reject participant")
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: trpc.validations.pathKey() })
        queryClient.invalidateQueries({ queryKey: trpc.participants.pathKey() })
        queryClient.invalidateQueries({ queryKey: trpc.users.pathKey() })
      },
    })
  )

  const handleVerify = async () => {
    if (!participant) return

    const blockingValidations = participant.validationResults.filter(
      (validation) =>
        validation.outcome === "failed" &&
        validation.severity === "error" &&
        !validation.overruled
    )

    try {
      for (const validation of blockingValidations) {
        await updateValidationResultMutation.mutateAsync({
          id: validation.id,
          data: {
            overruled: true,
          },
        })
      }

      await verifyParticipantMutation.mutateAsync({
        data: {
          participantId: participant.id,
          staffId: currentStaffId,
          notes: blockingValidations.length > 0 ? "Verified with overrulings from staff page" : "",
        },
      })
    } catch {
      // mutation callbacks handle messaging
    }
  }

  const isBusy =
    verifyParticipantMutation.isPending ||
    rejectParticipantMutation.isPending ||
    updateValidationResultMutation.isPending

  const blockingValidations = participant?.validationResults.filter(
    (validation) =>
      validation.outcome === "failed" && validation.severity === "error" && !validation.overruled
  )

  return (
    <>
      <DrawerLayout
        open={open}
        onOpenChange={onOpenChange}
        title={readOnly ? "Verified participant details" : "Participant details"}
      >
        {participantLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading participant information</p>
            </div>
          </div>
        ) : !participant ? (
          <div className="flex h-full items-center justify-center px-8">
            <div className="max-w-sm text-center">
              <XCircle className="mx-auto h-10 w-10 text-muted-foreground" />
              <h3 className="mt-4 font-medium">Participant not found</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                The selected participant could not be loaded for this marathon.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col">
            <div className="border-b bg-white/70 px-5 pb-4 pt-8 backdrop-blur-sm">
              <div className="mx-auto flex max-w-sm flex-col items-center gap-3 text-center">
                <div className="rounded-full border bg-background px-5 py-2 shadow-sm">
                  <span className="font-mono text-3xl font-semibold tracking-[0.2em]">
                    #{participant.reference}
                  </span>
                </div>
                <div>
                  <h2 className="font-rocgrotesk text-3xl">
                    {participant.firstname} {participant.lastname}
                  </h2>
                  {participant.email ? (
                    <p className="mt-1 text-sm text-muted-foreground">{participant.email}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className={
                      participant.status === "verified"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-amber-200 bg-amber-50 text-amber-700"
                    }
                  >
                    {participant.status === "verified" ? (
                      <CheckCircle2 className="mr-1 h-4 w-4" />
                    ) : (
                      <AlertTriangle className="mr-1 h-4 w-4" />
                    )}
                    {participant.status === "verified" ? "Verified" : "Not verified"}
                  </Button>
                  {participant.competitionClass ? (
                    <Button variant="outline" size="sm">
                      {participant.competitionClass.name}
                    </Button>
                  ) : null}
                  {participant.deviceGroup ? (
                    <Button variant="outline" size="sm">
                      {participant.deviceGroup.name}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              {!readOnly ? (
                <div className="mb-4 flex justify-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setRejectOpen(true)}
                    disabled={isBusy}
                    className="rounded-full"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Reject participant
                  </Button>
                </div>
              ) : null}

              <ValidationAccordion
                validationResults={participant.validationResults}
                submissions={participant.submissions}
                topics={topics}
                competitionClass={participant.competitionClass}
                onThumbnailClick={(url) => {
                  setPreviewUrl(url)
                  setPreviewOpen(true)
                }}
                onOverrule={(validationId) =>
                  updateValidationResultMutation.mutate({
                    id: validationId,
                    data: {
                      overruled: true,
                    },
                  })
                }
                isOverruling={updateValidationResultMutation.isPending}
                showOverruleButtons={!readOnly}
              />
            </div>

            {!readOnly ? (
              <div className="border-t bg-white/80 px-4 py-4 backdrop-blur-sm">
                <PrimaryButton
                  className="w-full rounded-full"
                  disabled={participant.status === "verified" || isBusy}
                  onClick={() => void handleVerify()}
                >
                  {isBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : participant.status === "verified" ? (
                    "Already verified"
                  ) : blockingValidations && blockingValidations.length > 0 ? (
                    "Overrule all and verify"
                  ) : (
                    "Verify participant"
                  )}
                </PrimaryButton>
              </div>
            ) : null}
          </div>
        )}
      </DrawerLayout>

      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject participant</AlertDialogTitle>
            <AlertDialogDescription>
              Enter the participant number to confirm rejection. This removes the submission and the
              participant must start over.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <Input
              autoFocus
              placeholder={participant?.reference ?? "0000"}
              value={confirmReference}
              onChange={(event) => {
                setConfirmReference(event.target.value)
                if (showRejectError) {
                  setShowRejectError(false)
                }
              }}
            />
            {showRejectError ? (
              <p className="text-sm text-destructive">Participant number does not match.</p>
            ) : null}
          </div>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel disabled={rejectParticipantMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={rejectParticipantMutation.isPending}
              onClick={(event) => {
                event.preventDefault()

                if (!participant) return

                if (confirmReference.trim() !== participant.reference.trim()) {
                  setShowRejectError(true)
                  return
                }

                rejectParticipantMutation.mutate({
                  reference: participant.reference,
                  domain,
                })
              }}
            >
              {rejectParticipantMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Reject participant"
              )}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <PreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} imageUrl={previewUrl} />
    </>
  )
}
