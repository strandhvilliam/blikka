'use client'

import { useState, Suspense } from 'react'
import { parseAsInteger, parseAsStringLiteral, useQueryState } from 'nuqs'
import { PrimaryButton } from '@/components/ui/primary-button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Gavel, Plus, Mail } from 'lucide-react'
import { JuryInvitationCreateDialog } from './jury-invitation-create-dialog'
import { JuryList } from './jury-list'
import { JuryListSkeleton } from './jury-list-skeleton'
import { JuryInvitationDetailsContent } from './jury-invitation-details-content'
import { JuryInvitationDetailsSkeleton } from './jury-invitation-details-skeleton'
import { JuryResultsTab, JuryResultsTabSkeleton } from './jury-results-tab'
import { juryTabs, resolveJuryTab } from '../_lib/search-params'

const tabTriggerClassName =
  "relative min-h-10 min-w-0 flex-1 justify-center rounded-none border-none bg-transparent px-0 py-2.5 text-[13px] font-semibold text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:text-brand-primary data-[state=active]:shadow-none data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-brand-primary data-[state=active]:after:content-['']"

function JuryEmptySelection() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50 mb-4">
        <Mail className="h-6 w-6 text-muted-foreground/40" />
      </div>
      <h2 className="text-base font-medium font-gothic mb-1">No Invitation Selected</h2>
      <p className="text-[13px] text-muted-foreground/70 max-w-[280px] text-center">
        Select an invitation from the list to view details, or create a new one to get started.
      </p>
    </div>
  )
}

export function JuryDashboard() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [invitationId, setInvitationId] = useQueryState('invitation', parseAsInteger)
  const [tab, setTab] = useQueryState('tab', parseAsStringLiteral(juryTabs))

  const activeTab = resolveJuryTab({ tab, invitation: invitationId })

  const selectInvitation = (id: number | null) => {
    void setInvitationId(id)
    if (id !== null) void setTab('jurors')
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] h-full flex flex-col px-4 py-3 sm:px-6 sm:py-4">
      <div className="shrink-0 mb-4 sm:mb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-1.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10">
                <Gavel className="h-[18px] w-[18px] text-brand-primary" strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                  Evaluation
                </p>
                <h1 className="text-2xl font-bold tracking-tight font-gothic leading-none">Jury</h1>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              See what the jury picked, and manage their invitations
            </p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0">
            <PrimaryButton
              onClick={() => setCreateDialogOpen(true)}
              className="text-xs min-h-9 flex-1 items-center justify-center gap-1.5 sm:flex-initial"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span>Invite</span>
            </PrimaryButton>
          </div>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => void setTab(value as (typeof juryTabs)[number])}
        className="flex min-h-0 min-w-0 flex-1 flex-col gap-0"
      >
        <div className="min-w-0 shrink-0 border-b border-border">
          <div className="w-full min-w-0 sm:max-w-[320px]">
            <TabsList className="-mb-px flex h-auto w-full min-w-0 gap-0 rounded-none bg-transparent p-0">
              <TabsTrigger value="results" className={tabTriggerClassName}>
                Results
              </TabsTrigger>
              <TabsTrigger value="jurors" className={tabTriggerClassName}>
                Jurors
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent
          value="results"
          className="mt-4 min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-white data-[state=active]:flex"
        >
          <Suspense fallback={<JuryResultsTabSkeleton />}>
            <JuryResultsTab />
          </Suspense>
        </TabsContent>

        <TabsContent
          value="jurors"
          className="mt-4 min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-white data-[state=active]:flex md:flex-row"
        >
          <div className="flex h-[min(42vh,300px)] shrink-0 flex-col border-b border-border md:h-auto md:w-80 md:shrink-0 md:border-r md:border-b-0 overflow-hidden">
            <Suspense fallback={<JuryListSkeleton />}>
              <JuryList
                selectedInvitationId={invitationId ?? undefined}
                onSelectInvitation={selectInvitation}
              />
            </Suspense>
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {invitationId == null ? (
              <JuryEmptySelection />
            ) : (
              <Suspense key={invitationId} fallback={<JuryInvitationDetailsSkeleton />}>
                <JuryInvitationDetailsContent
                  invitationId={invitationId}
                  onDeleted={() => selectInvitation(null)}
                />
              </Suspense>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <JuryInvitationCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onInvitationCreated={(id) => selectInvitation(id)}
      />
    </div>
  )
}
