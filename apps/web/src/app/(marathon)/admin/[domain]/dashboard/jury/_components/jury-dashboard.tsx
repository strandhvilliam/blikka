'use client'

import { useState, Suspense } from 'react'
import { parseAsInteger, useQueryState } from 'nuqs'
import { toast } from 'sonner'
import { PrimaryButton } from '@/components/ui/primary-button'
import { Button } from '@/components/ui/button'
import { Download, Gavel, Loader2, Plus, Mail } from 'lucide-react'
import { downloadFile } from '@/app/(marathon)/admin/[domain]/dashboard/export/_lib/download-file'
import { useDomain } from '@/lib/domain-provider'
import { JuryInvitationCreateDialog } from './jury-invitation-create-dialog'
import { JuryList } from './jury-list'
import { JuryListSkeleton } from './jury-list-skeleton'
import { JuryInvitationDetailsContent } from './jury-invitation-details-content'
import { JuryInvitationDetailsSkeleton } from './jury-invitation-details-skeleton'

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
  const domain = useDomain()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [invitationId, setInvitationId] = useQueryState('invitation', parseAsInteger)
  const [isExporting, setIsExporting] = useState(false)

  // The file comes from the same endpoint the export page uses, so both routes to it produce
  // byte-identical output rather than one of them drifting.
  const handleExport = async () => {
    setIsExporting(true)
    try {
      const dateStamp = new Date().toISOString().split('T')[0]
      await downloadFile(
        `/api/${domain}/export/csv_jury_results`,
        `jury-results-export-${dateStamp}.csv`,
      )
      toast.success('Jury results exported')
    } catch (error) {
      toast.error('Could not export jury results', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
      })
    } finally {
      setIsExporting(false)
    }
  }

  const selectInvitation = (id: number | null) => {
    void setInvitationId(id)
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
            <Button
              variant="outline"
              className="text-xs min-h-9 flex-1 items-center justify-center gap-1.5 sm:flex-initial"
              onClick={() => void handleExport()}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5 shrink-0" />
              )}
              <span>Export CSV</span>
            </Button>
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

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-white md:flex-row">
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
      </div>

      <JuryInvitationCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onInvitationCreated={(id) => selectInvitation(id)}
      />
    </div>
  )
}
