"use client"

import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, CheckCircle2, Loader2, Trash2, XCircle } from "lucide-react"
import { toast } from "sonner"
import type { Topic } from "@blikka/db"

import { cn } from "@/lib/utils"
import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PrimaryButton } from "@/components/ui/primary-button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import type { StaffParticipant } from "@/lib/staff/staff-types"
import { DrawerLayout } from "@/components/staff/drawer-layout"
import { PreviewDialog } from "@/components/staff/preview-dialog"
import { ValidationAccordion } from "@/components/staff/validation-accordion"

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
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 border-b bg-white px-5 pb-4 pt-6">
              <div className="flex items-center gap-4">
                <div className="shrink-0 rounded-xl bg-foreground/6 px-3.5 py-2">
                  <span className="font-mono text-lg font-semibold tracking-wider text-foreground">
                    #{participant.reference}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-gothic text-xl font-medium tracking-tight text-foreground">
                    {participant.firstname} {participant.lastname}
                  </h2>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                        participant.status === "verified"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700",
                      )}
                    >
                      {participant.status === "verified" ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <AlertTriangle className="h-3 w-3" />
                      )}
                      {participant.status === "verified" ? "Verified" : "Pending"}
                    </span>
                    {participant.competitionClass ? (
                      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {participant.competitionClass.name}
                      </span>
                    ) : null}
                    {participant.deviceGroup ? (
                      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {participant.deviceGroup.name}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              {participant.email ? (
                <p className="mt-2 text-xs text-muted-foreground">{participant.email}</p>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              {!readOnly ? (
                <div className="mb-3 flex justify-end px-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRejectOpen(true)}
                    disabled={isBusy}
                    className="rounded-full text-xs"
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Reject
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
              <div className="shrink-0 border-t bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
                <PrimaryButton
                  className="w-full rounded-full py-3.5"
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

      <Dialog open={rejectOpen} onOpenChange={(isOpen) => { if (!isOpen) setRejectOpen(false) }}>
        <DialogContent
          showCloseButton={false}
          className="top-[40%] border-none bg-transparent shadow-none"
        >
          <DialogHeader className="flex flex-col items-center text-center">
            <DialogTitle className="text-lg font-bold text-foreground drop-shadow-sm">
              Reject participant
            </DialogTitle>
            <DialogDescription className="text-center text-sm font-medium text-foreground/90 drop-shadow-sm">
              Enter the participant number to confirm. This removes their submission entirely.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <Input
              autoFocus
              type="text"
              inputMode="numeric"
              placeholder={participant?.reference ?? "0000"}
              value={confirmReference}
              onChange={(event) => {
                setConfirmReference(event.target.value)
                if (showRejectError) setShowRejectError(false)
              }}
              className={cn(
                "h-16 bg-background text-center font-mono text-4xl! font-bold tracking-widest",
                showRejectError && "border-red-500 focus-visible:ring-red-500",
              )}
              maxLength={6}
              enterKeyHint="done"
            />

            {showRejectError ? (
              <div className="flex items-center justify-center gap-2 text-sm text-red-600">
                <AlertTriangle className="h-4 w-4" />
                <span>Participant number does not match.</span>
              </div>
            ) : null}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRejectOpen(false)}
                disabled={rejectParticipantMutation.isPending}
                className="h-12 flex-1 rounded-full"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={!confirmReference.trim() || rejectParticipantMutation.isPending}
                onClick={() => {
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
                className="h-12 flex-1 rounded-full"
              >
                {rejectParticipantMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Reject"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} imageUrl={previewUrl} />
    </>
  )
}
