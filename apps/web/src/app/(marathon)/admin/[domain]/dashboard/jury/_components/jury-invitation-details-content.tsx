'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import {
  Trash2,
  Calendar,
  Tag,
  Users,
  ExternalLink,
  Copy,
  Mail,
  RefreshCw,
  CalendarPlus,
  MoreHorizontal,
  Star,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useTRPC } from '@/lib/trpc/client'
import { useDomain } from '@/lib/domain-provider'
import { getJuryEntryLink, getRankAssignments } from '@/lib/jury/jury-utils'
import { format } from 'date-fns'
import { JuryRatingsTable } from './jury-ratings-table'
import { JuryRankedPickCard } from './jury-ranked-pick-card'
import { JuryInvitationStatusBadge } from './jury-invitation-status-badge'
import { JuryInvitationExtendDialog } from './jury-invitation-extend-dialog'
import { JuryInvitationRegenerateDialog } from './jury-invitation-regenerate-dialog'

interface JuryInvitationDetailsContentProps {
  invitationId: number
  onDeleted?: () => void
}

export function JuryInvitationDetailsContent({
  invitationId,
  onDeleted,
}: JuryInvitationDetailsContentProps) {
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false)
  const [isExtendDialogOpen, setIsExtendDialogOpen] = useState(false)
  const [isRegenerateDialogOpen, setIsRegenerateDialogOpen] = useState(false)
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
  const { data: statistics } = useSuspenseQuery(
    trpc.jury.getJuryInvitationStatisticsById.queryOptions({
      id: invitationId,
    }),
  )

  const { mutate: executeDelete, isPending: isDeleting } = useMutation(
    trpc.jury.deleteJuryInvitation.mutationOptions({
      onError: (error) => {
        toast.error('Failed to delete invitation')
        console.error('Delete error:', error)
      },
      onSuccess: () => {
        toast.success('Invitation deleted successfully')
        onDeleted?.()
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.jury.getJuryInvitationsByDomain.queryKey({ domain }),
        })
      },
    }),
  )

  const { mutate: resendEmail, isPending: isResending } = useMutation(
    trpc.jury.resendJuryInvitationEmail.mutationOptions({
      onSuccess: () => {
        toast.success('Invite email sent')
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to resend invite email')
      },
    }),
  )

  const handleDelete = () => {
    executeDelete({ id: invitationId })
  }

  const juryLink = getJuryEntryLink(domain, invitation.token)

  const handleCopyLink = () => {
    navigator.clipboard.writeText(juryLink)
    toast.success('Link copied to clipboard')
  }

  const handleOpenLink = () => {
    window.open(juryLink, '_blank', 'noopener,noreferrer')
  }

  if (!invitation) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Invitation not found</p>
      </div>
    )
  }

  const isExpired = new Date(invitation.expiresAt) < new Date()
  const isCompleted = invitation.status === 'completed'
  const createdDate = format(new Date(invitation.createdAt), 'PPP')
  const expiryDate = format(new Date(invitation.expiresAt), 'PPP')
  const rankAssignments = getRankAssignments(reviewResults.ratings)
  const ratingsByParticipantId = new Map(
    reviewResults.ratings.map((rating) => [rating.participantId, rating]),
  )

  return (
    <>
      <div className="shrink-0 flex flex-col gap-3 border-b border-border px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-5">
        <div className="min-w-0 w-full sm:w-auto">
          <h2 className="text-base font-medium tracking-tight font-gothic leading-tight truncate">
            {invitation.displayName}
          </h2>
          <p className="break-words text-[12px] text-muted-foreground mt-0.5">{invitation.email}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={handleCopyLink}>
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            Copy link
          </Button>
          <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={handleOpenLink}>
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            Open
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" aria-label="More actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                disabled={isExpired || isResending}
                onSelect={() => resendEmail({ id: invitationId, domain })}
              >
                <Mail className="h-3.5 w-3.5" />
                {isResending ? 'Sending…' : 'Resend email'}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setIsExtendDialogOpen(true)}>
                <CalendarPlus className="h-3.5 w-3.5" />
                Extend expiry
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={isCompleted}
                onSelect={() => setIsRegenerateDialogOpen(true)}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerate link
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={isDeleting}
                onSelect={() => setIsRemoveDialogOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete invitation
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <ScrollArea className="min-h-0 min-w-0 flex-1 [&_[data-slot=scroll-area-viewport]]:min-w-0">
        <div className="box-border w-full min-w-0 space-y-5 p-4 sm:p-5">
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="h-1 w-1 rounded-full bg-brand-primary" />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                Review progress
              </span>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-4 sm:p-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border/60 bg-white px-3.5 py-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
                    Reviewed
                  </p>
                  <p className="mt-1 flex items-baseline gap-1 font-gothic">
                    <span className="text-2xl font-bold leading-none tabular-nums">
                      {statistics.ratedParticipants}
                    </span>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      / {statistics.totalParticipants}
                    </span>
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-white px-3.5 py-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
                    Avg rating
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 font-gothic">
                    <span className="text-2xl font-bold leading-none tabular-nums">
                      {statistics.averageRating > 0 ? statistics.averageRating.toFixed(1) : '—'}
                    </span>
                    {statistics.averageRating > 0 && (
                      <Star className="h-4 w-4 fill-brand-primary text-brand-primary" />
                    )}
                  </p>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium tabular-nums text-muted-foreground">
                    {Math.round(Math.min(100, statistics.progressPercentage))}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-brand-primary transition-all"
                    style={{ width: `${Math.min(100, statistics.progressPercentage)}%` }}
                  />
                </div>
              </div>
              {statistics.ratingDistribution.some(({ count }) => count > 0) && (
                <div className="flex flex-wrap gap-1.5">
                  {statistics.ratingDistribution.map(({ rating, count }) =>
                    count > 0 ? (
                      <span
                        key={rating}
                        className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-white px-2.5 py-1 text-[11px] font-medium tabular-nums"
                      >
                        {rating}
                        <Star className="h-2.5 w-2.5 fill-brand-primary text-brand-primary" />
                        <span className="text-muted-foreground">{count}</span>
                      </span>
                    ) : null,
                  )}
                </div>
              )}
            </div>
          </section>

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
                    <JuryInvitationStatusBadge status={invitation.status} />
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
                    {invitation.inviteType === 'topic' ? (
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

              {invitation.inviteType === 'topic' && invitation.topic && (
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-1.5">
                    Topic
                  </p>
                  <p className="text-[13px] break-words">
                    Topic {invitation.topic.orderIndex + 1}: {invitation.topic.name}
                  </p>
                </div>
              )}

              {invitation.inviteType === 'class' && (
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
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {([1, 2, 3] as const).map((rank) => {
                const participantId = rankAssignments.get(rank)
                const rating =
                  participantId !== undefined
                    ? (ratingsByParticipantId.get(participantId) ?? null)
                    : null

                return (
                  <JuryRankedPickCard
                    key={rank}
                    rank={rank}
                    participantReference={rating?.participant?.reference}
                  />
                )
              })}
            </div>
          </section>

          <JuryRatingsTable ratings={reviewResults.ratings} />

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

      <JuryInvitationExtendDialog
        invitationId={invitationId}
        open={isExtendDialogOpen}
        onOpenChange={setIsExtendDialogOpen}
      />
      <JuryInvitationRegenerateDialog
        invitationId={invitationId}
        open={isRegenerateDialogOpen}
        onOpenChange={setIsRegenerateDialogOpen}
      />

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
