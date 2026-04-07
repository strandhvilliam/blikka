"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Trash2, Calendar, Tag, Users, ExternalLink, Copy, CheckCircle2, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useState } from "react"
import { toast } from "sonner"
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
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import { cn, formatDomainLink } from "@/lib/utils"
import { format } from "date-fns"
import type { JuryInvitation } from "@blikka/db"

interface JuryInvitationDetailsContentProps {
  invitationId: number
  onDeleted?: () => void
}

function getStatusBadge(status: JuryInvitation["status"]) {
  const baseClasses = "text-xs font-medium gap-1 h-5 px-1.5 [&>svg]:size-2.5 border"
  switch (status) {
    case "completed":
      return (
        <Badge
          variant="outline"
          className={cn(
            baseClasses,
            "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
          )}
        >
          <CheckCircle2 />
          Completed
        </Badge>
      )
    case "in_progress":
      return (
        <Badge
          variant="outline"
          className={cn(
            baseClasses,
            "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
          )}
        >
          <Clock />
          In Progress
        </Badge>
      )
    default:
      return (
        <Badge
          variant="outline"
          className={cn(
            baseClasses,
            "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700",
          )}
        >
          <Clock />
          Pending
        </Badge>
      )
  }
}

export function JuryInvitationDetailsContent({
  invitationId,
  onDeleted,
}: JuryInvitationDetailsContentProps) {
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false)
  const trpc = useTRPC()
  const domain = useDomain()
  const queryClient = useQueryClient()

  const { data: invitation } = useSuspenseQuery(
    trpc.jury.getJuryInvitationById.queryOptions({
      id: invitationId,
    }),
  )
  const { data: reviewResults } = useSuspenseQuery(
    trpc.jury.getJuryReviewResultsByInvitationId.queryOptions({
      id: invitationId,
    }),
  )

  const { mutate: executeDelete, isPending: isDeleting } = useMutation(
    trpc.jury.deleteJuryInvitation.mutationOptions({
      onError: (error) => {
        toast.error("Failed to delete invitation")
        console.error("Delete error:", error)
      },
      onSuccess: () => {
        toast.success("Invitation deleted successfully")
        onDeleted?.()
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.jury.getJuryInvitationsByDomain.queryKey({ domain }),
        })
      },
    }),
  )

  const handleDelete = () => {
    executeDelete({ id: invitationId })
  }

  const juryLink = formatDomainLink(`/live/jury/${invitation.token}`, domain, "live")

  const handleCopyLink = () => {
    navigator.clipboard.writeText(juryLink)
    toast.success("Link copied to clipboard")
  }

  const handleOpenLink = () => {
    window.open(juryLink, "_blank", "noopener,noreferrer")
  }

  if (!invitation) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Invitation not found</p>
      </div>
    )
  }

  const isExpired = new Date(invitation.expiresAt) < new Date()
  const createdDate = format(new Date(invitation.createdAt), "PPP")
  const expiryDate = format(new Date(invitation.expiresAt), "PPP")
  const rankedResults = reviewResults.ratings
    .filter((rating) => rating.finalRanking !== null)
    .toSorted((left, right) => (left.finalRanking ?? 0) - (right.finalRanking ?? 0))

  return (
    <>
      <div className="shrink-0 flex flex-col gap-3 border-b border-border px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-5">
        <div className="min-w-0 w-full sm:w-auto">
          <h2 className="text-base font-medium tracking-tight font-gothic leading-tight truncate">
            {invitation.displayName}
          </h2>
          <p className="break-words text-[12px] text-muted-foreground mt-0.5">{invitation.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={handleCopyLink}>
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            Copy Link
          </Button>
          <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={handleOpenLink}>
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            Open
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20"
            disabled={isDeleting}
            onClick={() => setIsRemoveDialogOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Delete
          </Button>
        </div>
      </div>
      <ScrollArea className="min-h-0 min-w-0 flex-1 [&_[data-slot=scroll-area-viewport]]:min-w-0">
        <div className="box-border w-full min-w-0 max-w-3xl space-y-5 p-4 sm:p-5">
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="h-1 w-1 rounded-full bg-brand-primary" />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                Details
              </span>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-4 sm:p-5">
              <div className="grid grid-cols-1 gap-4 min-w-0 sm:grid-cols-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-1.5">
                    Status
                  </p>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    {getStatusBadge(invitation.status)}
                    {isExpired && (
                      <Badge variant="destructive" className="text-[10px]">
                        Expired
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-1.5">
                    Type
                  </p>
                  <div className="flex min-w-0 items-center gap-2">
                    {invitation.inviteType === "topic" ? (
                      <>
                        <Tag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="text-[13px] break-words">Topic Invite</span>
                      </>
                    ) : (
                      <>
                        <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="text-[13px] break-words">Class Invite</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 min-w-0 sm:grid-cols-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-1.5">
                    Created
                  </p>
                  <div className="flex min-w-0 items-start gap-2">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
                    <span className="text-[13px] break-words">{createdDate}</span>
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-1.5">
                    Expires
                  </p>
                  <div className="flex min-w-0 items-start gap-2">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
                    <span className="text-[13px] break-words">{expiryDate}</span>
                  </div>
                </div>
              </div>

              {invitation.inviteType === "topic" && invitation.topic && (
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-1.5">
                    Topic
                  </p>
                  <p className="text-[13px] break-words">
                    Topic {invitation.topic.orderIndex + 1}: {invitation.topic.name}
                  </p>
                </div>
              )}

              {invitation.inviteType === "class" && (
                <>
                  {invitation.competitionClass && (
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-1.5">
                        Competition Class
                      </p>
                      <p className="text-[13px] break-words">{invitation.competitionClass.name}</p>
                    </div>
                  )}
                  {invitation.deviceGroup && (
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-1.5">
                        Device Group
                      </p>
                      <p className="text-[13px] break-words">{invitation.deviceGroup.name}</p>
                    </div>
                  )}
                </>
              )}

              {invitation.notes && (
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-1.5">
                    Notes
                  </p>
                  <p className="text-[13px] whitespace-pre-wrap break-words">{invitation.notes}</p>
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="h-1 w-1 rounded-full bg-brand-primary" />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                Ranked Picks
              </span>
            </div>
            <div className="space-y-1.5">
              {[1, 2, 3].map((rank) => {
                const rating = rankedResults.find((entry) => entry.finalRanking === rank) ?? null

                return (
                  <div
                    key={rank}
                    className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2"
                  >
                    <p className="shrink-0 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {rank === 1 ? "1st place" : rank === 2 ? "2nd place" : "3rd place"}
                    </p>
                    <p className="min-w-0 flex-1 truncate text-right text-[13px] font-medium tabular-nums">
                      {rating?.participant?.reference
                        ? `#${rating.participant.reference}`
                        : "Not selected"}
                    </p>
                  </div>
                )
              })}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="h-1 w-1 rounded-full bg-brand-primary" />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                Access Link
              </span>
            </div>
            <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
              <code className="min-w-0 flex-1 break-all rounded-md border border-border/40 bg-white/80 px-2.5 py-1.5 font-mono text-[11px] leading-snug text-foreground">
                {juryLink}
              </code>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 shrink-0"
                onClick={handleCopyLink}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </section>
        </div>
      </ScrollArea>

      <AlertDialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Jury Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the jury invitation for {invitation.email}? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
