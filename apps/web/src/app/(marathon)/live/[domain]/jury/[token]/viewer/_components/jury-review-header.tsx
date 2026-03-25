"use client"

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
import { PrimaryButton } from "@/components/ui/primary-button"
import { useTRPC } from "@/lib/trpc/client"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, UserIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { getJuryCompletedPath } from "../../_lib/jury-paths"
import type { JuryInvitation } from "../../_lib/jury-types"
import { ProgressRing } from "./jury-progress-ring"

export function JuryReviewHeader({
  domain,
  token,
  invitation,
  ratedCount,
  totalParticipants,
}: {
  domain: string
  token: string
  invitation: JuryInvitation
  ratedCount: number
  totalParticipants: number
}) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const router = useRouter()

  const completeMutation = useMutation(
    trpc.jury.updateInvitationStatusByToken.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.jury.pathKey(),
        })
        toast.success("Review completed")
        router.push(getJuryCompletedPath(domain, token))
      },
      onError: (error) => {
        toast.error(error.message || "Failed to complete review")
      },
    }),
  )

  return (
    <header className="rounded-xl border border-border/60 bg-white px-5 py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <ProgressRing rated={ratedCount} total={totalParticipants} />
          <div>
            <h1 className="font-rocgrotesk text-2xl font-bold tracking-tight text-brand-black">
              Jury Review
            </h1>
            <p className="mt-0.5 text-sm text-brand-gray">{invitation.marathon.name}</p>
          </div>
          <div className="ml-2 hidden flex-wrap gap-1.5 lg:flex">
            {invitation.topic?.name ? (
              <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium text-brand-black/70">
                {invitation.topic.name}
              </span>
            ) : null}
            {invitation.competitionClass?.name ? (
              <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium text-brand-black/70">
                {invitation.competitionClass.name}
              </span>
            ) : null}
            {invitation.deviceGroup?.name ? (
              <span className="rounded-full border border-border/60 px-2.5 py-0.5 text-[11px] font-medium text-brand-gray">
                {invitation.deviceGroup.name}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-neutral-50 px-3.5 py-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-brand-black">
              <UserIcon className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-sm font-medium text-brand-black">{invitation.displayName}</p>
              <p className="text-[11px] text-brand-gray">
                {ratedCount}/{totalParticipants} rated
              </p>
            </div>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <PrimaryButton>
                <CheckCircle2 className="h-4 w-4" />
                Complete
              </PrimaryButton>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Complete review</AlertDialogTitle>
                <AlertDialogDescription>
                  You will no longer be able to edit ratings after marking this review as completed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={completeMutation.isPending}
                  onClick={() =>
                    completeMutation.mutate({
                      token,
                      domain,
                      status: "completed",
                    })
                  }
                >
                  {completeMutation.isPending ? "Completing..." : "Complete review"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </header>
  )
}
