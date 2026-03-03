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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface JuryInvitationDetailsContentProps {
  invitationId: number
}

function getStatusBadge(status: JuryInvitation["status"]) {
  switch (status) {
    case "completed":
      return <Badge className="bg-green-600">Completed</Badge>
    case "in_progress":
      return <Badge className="bg-blue-600">In Progress</Badge>
    default:
      return <Badge className="bg-yellow-600">Pending</Badge>
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
    })
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
    })
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
      <div className="p-6 space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold font-gothic mb-1">{invitation.displayName}</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Mail className="h-4 w-4" />
              {invitation.email}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyLink}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Link
            </Button>
            <Button variant="outline" size="sm" onClick={handleOpenLink}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Link
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={() => setIsRemoveDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        {/* Main Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Invitation Details</CardTitle>
            <CardDescription>Information about this jury invitation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Status</p>
                <div className="flex items-center gap-2">
                  {getStatusBadge(invitation.status)}
                  {isExpired && <Badge variant="destructive">Expired</Badge>}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Type</p>
                <div className="flex items-center gap-2">
                  {invitation.inviteType === "topic" ? (
                    <>
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Topic Invite</span>
                    </>
                  ) : (
                    <>
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Class Invite</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Created</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{createdDate}</span>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Expires</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{expiryDate}</span>
                </div>
              </div>
            </div>

            {invitation.inviteType === "topic" && invitation.topic && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Topic</p>
                <p className="text-sm">
                  Topic {invitation.topic.orderIndex + 1}: {invitation.topic.name}
                </p>
              </div>
            )}

            {invitation.inviteType === "class" && (
              <>
                {invitation.competitionClass && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Competition Class
                    </p>
                    <p className="text-sm">{invitation.competitionClass.name}</p>
                  </div>
                )}
                {invitation.deviceGroup && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Device Group</p>
                    <p className="text-sm">{invitation.deviceGroup.name}</p>
                  </div>
                )}
              </>
            )}

            {invitation.notes && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Notes</p>
                <p className="text-sm whitespace-pre-wrap">{invitation.notes}</p>
              </div>
            )}

            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-2">Jury Access Link</p>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                  {juryLink}
                </code>
                <Button size="sm" variant="ghost" onClick={handleCopyLink}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

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
