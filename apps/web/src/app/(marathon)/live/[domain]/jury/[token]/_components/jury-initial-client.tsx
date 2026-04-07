"use client"

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { motion } from "motion/react"
import { CheckCircle2, ImageIcon, PlayIcon, Tag, UserIcon } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useTRPC } from "@/lib/trpc/client"
import { PrimaryButton } from "@/components/ui/primary-button"
import { Badge } from "@/components/ui/badge"
import { getJuryViewerPath } from "../_lib/jury-paths"

export function JuryInitialClient({
  domain,
  token,
}: {
  domain: string
  token: string
}) {
  const trpc = useTRPC()
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: invitation } = useSuspenseQuery(
    trpc.jury.verifyTokenAndGetInitialData.queryOptions({ domain, token }),
  )

  const startReviewMutation = useMutation(
    trpc.jury.updateInvitationStatusByToken.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.jury.pathKey(),
        })
        toast.success("Review started")
        router.push(getJuryViewerPath(domain, token))
      },
      onError: (error) => {
        toast.error(error.message || "Failed to start review")
      },
    }),
  )

  const inviteLabel =
    invitation.inviteType === "topic"
      ? (invitation.topic?.name ?? "Topic review")
      : (invitation.competitionClass?.name ?? "Class review")

  return (
    <div className="flex min-h-dvh flex-col pt-4">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-6">
        <div className="flex flex-col items-center pb-10">
          {invitation.marathon.logoUrl ? (
            <div className="mb-3 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border shadow-sm">
              <img
                src={invitation.marathon.logoUrl}
                alt={invitation.marathon.name}
                width={96}
                height={96}
              />
            </div>
          ) : (
            <div className="mb-3 flex h-24 w-24 items-center justify-center rounded-full bg-muted">
              <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
            </div>
          )}
          <h1 className="mt-2 text-center font-gothic text-2xl font-medium tracking-tight text-foreground">
            {invitation.marathon.name}
          </h1>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, type: "spring", stiffness: 200, damping: 24 }}
          className="overflow-hidden rounded-2xl border border-border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)]"
        >
          <div className="p-6">
            <div className="mb-6 text-center">
              <h2 className="text-lg font-semibold text-foreground">
                Welcome, {invitation.displayName}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Review and rate submissions for this live marathon.
              </p>
            </div>

            <div className="grid gap-3">
              <div className="flex items-center gap-3 rounded-xl border bg-muted/30 px-4 py-3">
                <div className="rounded-full bg-blue-100 p-2 text-blue-600">
                  <UserIcon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">Jury member</p>
                  <p className="text-sm text-muted-foreground">
                    {invitation.displayName}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl border bg-muted/30 px-4 py-3">
                <div className="rounded-full bg-emerald-100 p-2 text-emerald-600">
                  <Tag className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {invitation.inviteType === "topic" ? "Topic" : "Class"}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      {inviteLabel}
                    </p>
                    {invitation.deviceGroup?.name ? (
                      <Badge variant="secondary">
                        {invitation.deviceGroup.name}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl border bg-muted/30 px-4 py-3">
                <div className="rounded-full bg-amber-100 p-2 text-amber-600">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">Review deadline</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(invitation.expiresAt).toLocaleDateString(
                      "en-US",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      },
                    )}
                  </p>
                </div>
              </div>
            </div>

            {invitation.notes ? (
              <div className="mt-4 rounded-xl bg-muted/30 px-4 py-3">
                <p className="mb-1 text-sm font-medium">Notes</p>
                <p className="text-sm text-muted-foreground">
                  {invitation.notes}
                </p>
              </div>
            ) : null}

            <div className="mt-4 rounded-xl bg-muted/30 p-4">
              <p className="text-center text-sm leading-relaxed text-muted-foreground">
                Stars and notes are private review aids. Before you complete
                the review, you must also choose your ranked winners: 1st,
                2nd, and 3rd place.
              </p>
            </div>

            <div className="mt-6">
              <PrimaryButton
                className="w-full rounded-full py-3 text-base"
                disabled={startReviewMutation.isPending}
                onClick={() =>
                  startReviewMutation.mutate({
                    token,
                    domain,
                    status: "in_progress",
                  })
                }
              >
                {startReviewMutation.isPending
                  ? "Starting..."
                  : "Start review"}
                <PlayIcon className="h-4 w-4" />
              </PrimaryButton>
            </div>
          </div>
        </motion.div>

        <div className="mt-6 flex flex-col items-center">
          <p className="mb-1 text-xs italic text-muted-foreground">Powered by</p>
          <div className="flex items-center gap-1.5">
            <Image src="/blikka-logo.svg" alt="Blikka" width={20} height={17} />
            <span className="font-special-gothic text-base tracking-tight">blikka</span>
          </div>
        </div>
      </main>
    </div>
  )
}
