"use client"

import { useSession } from "@/lib/auth/client"
import { useTRPC } from "@/lib/trpc/client"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Shield, Loader2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { ParticipantWithRelations } from "../_lib/utils"

interface ParticipantVerifyDialogProps {
  participant: ParticipantWithRelations
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function ParticipantVerifyDialog({
  participant,
  isOpen,
  onOpenChange,
}: ParticipantVerifyDialogProps) {
  const queryClient = useQueryClient()
  const trpc = useTRPC()
  const { data: session } = useSession()
  const user = session?.user

  const { mutate: verifyParticipant, isPending: isVerifying } = useMutation(
    trpc.validations.createParticipantVerification.mutationOptions({
      onSuccess: () => {
        toast.success("Participant verified successfully")
        onOpenChange(false)
      },
      onError: () => {
        toast.error("Failed to verify participant")
        onOpenChange(false)
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.participants.pathKey(),
        })
        queryClient.invalidateQueries({
          queryKey: trpc.validations.pathKey(),
        })
      },
    })
  )

  const handleVerifyParticipant = () => {
    if (!user?.id) {
      toast.error("Unable to determine logged in user")
      return
    }

    verifyParticipant({
      data: {
        participantId: participant.id,
        staffId: user.id,
        notes: "Verified from admin panel",
      },
    })
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-rocgrotesk">
            Verify Participant
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to verify {participant.firstname}{" "}
            {participant.lastname} (#{participant.reference})? This action will
            mark their submission as verified and cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isVerifying}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => handleVerifyParticipant()}
            disabled={isVerifying}
            className="bg-primary hover:bg-primary/90"
          >
            {isVerifying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <Shield className="h-4 w-4 mr-2" />
                Verify Participant
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

