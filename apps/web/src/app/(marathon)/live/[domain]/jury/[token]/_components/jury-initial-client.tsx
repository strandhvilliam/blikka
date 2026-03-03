"use client"

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { motion } from "motion/react"
import { CheckCircle2, ImageIcon, PlayIcon, Tag, UserIcon } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useTRPC } from "@/lib/trpc/client"
import { PrimaryButton } from "@/components/ui/primary-button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
      ? invitation.topic?.name ?? "Topic review"
      : invitation.competitionClass?.name ?? "Class review"

  return (
    <div className="flex flex-col min-h-dvh relative overflow-hidden pt-4">
      <div className="z-20 flex flex-col flex-1 h-full">
        <main className="flex-1 px-6 pb-6 max-w-md mx-auto w-full flex flex-col justify-center">
          <div className="flex flex-col items-center pb-12">
            {invitation.marathon.logoUrl ? (
              <div className="w-24 h-24 rounded-full flex items-center justify-center mb-3 overflow-hidden shadow border">
                <img
                  src={invitation.marathon.logoUrl}
                  alt={invitation.marathon.name}
                  width={96}
                  height={96}
                />
              </div>
            ) : (
              <div className="w-24 h-24 rounded-full flex items-center justify-center bg-gray-200">
                <ImageIcon className="w-12 h-12" />
              </div>
            )}
            <h1 className="text-2xl font-rocgrotesk font-extrabold text-gray-900 text-center mt-2">
              {invitation.marathon.name}
            </h1>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <Card className="bg-white/95 backdrop-blur-sm rounded-3xl border border-border shadow-xl">
              <CardHeader className="text-center space-y-3">
                <div className="mx-auto w-fit rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                  Jury invitation
                </div>
                <CardTitle className="text-2xl font-rocgrotesk">
                  Welcome, {invitation.displayName}
                </CardTitle>
                <CardDescription>
                  Review and rate submissions for this live marathon.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3">
                  <div className="flex items-center gap-3 rounded-2xl border bg-muted/40 px-4 py-3">
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

                  <div className="flex items-center gap-3 rounded-2xl border bg-muted/40 px-4 py-3">
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

                  <div className="flex items-center gap-3 rounded-2xl border bg-muted/40 px-4 py-3">
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
                  <div className="rounded-2xl border bg-muted/30 px-4 py-3">
                    <p className="mb-1 text-sm font-medium">Notes</p>
                    <p className="text-sm text-muted-foreground">
                      {invitation.notes}
                    </p>
                  </div>
                ) : null}

                <div className="rounded-2xl border border-primary/10 bg-primary/5 px-4 py-4 text-sm text-muted-foreground">
                  Rate each participant from 1 to 5 stars and leave notes if
                  needed. When you are done, mark the review as completed.
                </div>

                <PrimaryButton
                  className="w-full py-3 text-base rounded-full"
                  disabled={startReviewMutation.isPending}
                  onClick={() =>
                    startReviewMutation.mutate({
                      token,
                      domain,
                      status: "in_progress",
                    })
                  }
                >
                  {startReviewMutation.isPending ? "Starting..." : "Start review"}
                  <PlayIcon className="h-4 w-4" />
                </PrimaryButton>
              </CardContent>
            </Card>
          </motion.div>

          <div className="mt-6 flex flex-col items-center">
            <p className="text-xs text-muted-foreground mb-1 italic">
              Powered by
            </p>
            <div className="flex items-center gap-1.5">
              <Image
                src="/blikka-logo.svg"
                alt="Blikka"
                width={20}
                height={17}
              />
              <span className="font-rocgrotesk font-bold text-base tracking-tight">
                blikka
              </span>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
