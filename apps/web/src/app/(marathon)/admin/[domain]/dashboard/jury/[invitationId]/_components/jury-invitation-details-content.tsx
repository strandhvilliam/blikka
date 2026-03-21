"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Mail, Trash2, Calendar, Tag, Users, ExternalLink, Copy } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useState } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
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
import { formatDomainLink, formatDomainPathname } from "@/lib/utils"
import { format } from "date-fns"
import type { JuryInvitation } from "@blikka/db"

interface JuryInvitationDetailsContentProps {
  invitationId: number
}

function getStatusBadge(status: JuryInvitation["status"]) {
  switch (status) {
    case "completed":
      return <Badge className="bg-green-600 text-[10px]">Completed</Badge>
    case "in_progress":
      return <Badge className="bg-blue-600 text-[10px]">In Progress</Badge>
    default:
      return <Badge className="bg-yellow-600 text-[10px]">Pending</Badge>
  }
}

export function JuryInvitationDetailsContent({ invitationId }: JuryInvitationDetailsContentProps) {
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false)
  const router = useRouter()
  const trpc = useTRPC()
  const domain = useDomain()
  const queryClient = useQueryClient()

  const { data: invitation } = useSuspenseQuery(
    trpc.jury.getJuryInvitationById.queryOptions({
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
        router.push(formatDomainPathname("/admin/dashboard/jury", domain))
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

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10">
              <Mail className="h-5 w-5 text-brand-primary" strokeWidth={1.8} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                Invitation
              </p>
              <h1 className="text-xl font-bold tracking-tight font-gothic leading-tight">
                {invitation.displayName}
              </h1>
              <p className="text-[12px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                {invitation.email}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={handleCopyLink}
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              Copy Link
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={handleOpenLink}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Open
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-8 px-3 text-xs"
              disabled={isDeleting}
              onClick={() => setIsRemoveDialogOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Delete
            </Button>
          </div>
        </div>

        {/* Invitation Details */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="h-1 w-1 rounded-full bg-brand-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              Details
            </span>
          </div>
          <div className="rounded-xl border border-border bg-white p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-1.5">
                  Status
                </p>
                <div className="flex items-center gap-2">
                  {getStatusBadge(invitation.status)}
                  {isExpired && (
                    <Badge variant="destructive" className="text-[10px]">
                      Expired
                    </Badge>
                  )}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-1.5">
                  Type
                </p>
                <div className="flex items-center gap-2">
                  {invitation.inviteType === "topic" ? (
                    <>
                      <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-[13px]">Topic Invite</span>
                    </>
                  ) : (
                    <>
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-[13px]">Class Invite</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-1.5">
                  Created
                </p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[13px]">{createdDate}</span>
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-1.5">
                  Expires
                </p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[13px]">{expiryDate}</span>
                </div>
              </div>
            </div>

            {invitation.inviteType === "topic" && invitation.topic && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-1.5">
                  Topic
                </p>
                <p className="text-[13px]">
                  Topic {invitation.topic.orderIndex + 1}: {invitation.topic.name}
                </p>
              </div>
            )}

            {invitation.inviteType === "class" && (
              <>
                {invitation.competitionClass && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-1.5">
                      Competition Class
                    </p>
                    <p className="text-[13px]">{invitation.competitionClass.name}</p>
                  </div>
                )}
                {invitation.deviceGroup && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-1.5">
                      Device Group
                    </p>
                    <p className="text-[13px]">{invitation.deviceGroup.name}</p>
                  </div>
                )}
              </>
            )}

            {invitation.notes && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-1.5">
                  Notes
                </p>
                <p className="text-[13px] whitespace-pre-wrap">{invitation.notes}</p>
              </div>
            )}
          </div>
        </section>

        {/* Jury Access Link */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="h-1 w-1 rounded-full bg-brand-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              Access Link
            </span>
          </div>
          <div className="rounded-xl border border-border bg-white p-4">
            <div className="flex items-center gap-2">
              <code className="text-[11px] bg-muted/50 px-2.5 py-1.5 rounded-lg flex-1 truncate font-mono">
                {juryLink}
              </code>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleCopyLink}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </section>

        {/* Delete Dialog */}
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
      </div>
    </ScrollArea>
  )
}
