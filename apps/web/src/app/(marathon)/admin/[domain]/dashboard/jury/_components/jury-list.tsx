'use client'

import { Search, Mail, Tag, Users, Calendar } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useTRPC } from '@/lib/trpc/client'
import { useDomain } from '@/lib/domain-provider'
import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { JuryInvitationStatusBadge } from './jury-invitation-status-badge'

interface JuryListProps {
  selectedInvitationId?: number
  onSelectInvitation: (id: number) => void
}

export function JuryList({ selectedInvitationId, onSelectInvitation }: JuryListProps) {
  const domain = useDomain()
  const trpc = useTRPC()
  const { data: invitations } = useSuspenseQuery(
    trpc.jury.getJuryInvitationsByDomain.queryOptions({
      domain,
    }),
  )

  const [search, setSearch] = useState('')
  const filteredInvitations = useMemo(() => {
    if (!search.trim()) return invitations
    const searchLower = search.toLowerCase()
    return invitations.filter(
      (invitation) =>
        invitation.email.toLowerCase().includes(searchLower) ||
        invitation.displayName.toLowerCase().includes(searchLower),
    )
  }, [search, invitations])

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-3 border-b border-border">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search invitations..."
            className="h-9 bg-muted/50 border-border/40 pl-9 focus-visible:ring-1 focus-visible:ring-primary/20"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <ScrollArea className="min-h-0 min-w-0 flex-1 [&_[data-slot=scroll-area-viewport]]:min-w-0">
        <div className="min-w-0 space-y-0.5">
          {filteredInvitations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <Mail className="h-12 w-12 mb-3 text-muted-foreground/50" />
              <p className="text-sm font-medium text-muted-foreground">
                {search ? 'No invitations found' : 'No invitations yet'}
              </p>
              {search && (
                <p className="text-xs text-muted-foreground mt-1">
                  Try adjusting your search query
                </p>
              )}
            </div>
          ) : (
            filteredInvitations.map((invitation) => {
              const isActive = selectedInvitationId === invitation.id
              return (
                <button
                  key={invitation.id}
                  type="button"
                  onClick={() => onSelectInvitation(invitation.id)}
                  className={cn(
                    'block w-full min-w-0 max-w-full px-3 py-2.5 text-left transition-all hover:bg-muted/50',
                    isActive && 'bg-muted/80 border-l-2 border-primary',
                  )}
                >
                  <div className="flex min-w-0 flex-col gap-2">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-1">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium" title={invitation.displayName}>
                          {invitation.displayName}
                        </p>
                        <p className="mt-0.5 flex min-w-0 items-center gap-1 truncate text-xs text-muted-foreground">
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="min-w-0 truncate" title={invitation.email}>
                            {invitation.email}
                          </span>
                        </p>
                      </div>
                      <div className="shrink-0 justify-self-end pt-0.5">
                        <JuryInvitationStatusBadge status={invitation.status} isActive={isActive} />
                      </div>
                    </div>
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      {invitation.inviteType === 'topic' ? (
                        <>
                          <Tag className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            {invitation.topic
                              ? `Topic ${invitation.topic.orderIndex + 1}`
                              : 'Topic'}
                          </span>
                        </>
                      ) : (
                        <>
                          <Users className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            {invitation.competitionClass?.name || 'Class'}
                          </span>
                        </>
                      )}
                      <span className="text-muted-foreground/50">•</span>
                      <Calendar className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        {format(new Date(invitation.expiresAt), 'MMM d')}
                      </span>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
