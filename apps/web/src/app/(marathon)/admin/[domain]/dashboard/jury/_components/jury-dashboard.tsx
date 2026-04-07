"use client"

import { useState, Suspense } from "react"
import { parseAsInteger, useQueryState } from "nuqs"
import { PrimaryButton } from "@/components/ui/primary-button"
import { Gavel, Plus, Mail } from "lucide-react"
import { JuryInvitationCreateSheet } from "./jury-create-sheet"
import { JuryList } from "./jury-list"
import { JuryListSkeleton } from "./jury-list-skeleton"
import { JuryInvitationDetailsContent } from "./jury-invitation-details-content"
import { JuryInvitationDetailsSkeleton } from "./jury-invitation-details-skeleton"

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
  const [createSheetOpen, setCreateSheetOpen] = useState(false)
  const [invitationId, setInvitationId] = useQueryState("invitation", parseAsInteger)

  return (
    <div className="flex h-full gap-5 mx-auto w-full max-w-[1600px] px-6 py-4">
      <div className="w-80 shrink-0 flex flex-col rounded-xl border border-border bg-white overflow-hidden">
        <div className="border-b border-border px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary/10">
                <Gavel className="h-4 w-4 text-brand-primary" strokeWidth={1.8} />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                  Evaluation
                </p>
                <h1 className="text-lg font-bold tracking-tight font-gothic leading-none">Jury Invitations</h1>
              </div>
            </div>
            <PrimaryButton
              onClick={() => setCreateSheetOpen(true)}
              className="h-8 shrink-0 gap-1.5 px-2.5 py-0 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Invite</span>
            </PrimaryButton>
          </div>
        </div>
        <Suspense fallback={<JuryListSkeleton />}>
          <JuryList
            selectedInvitationId={invitationId ?? undefined}
            onSelectInvitation={(id) => void setInvitationId(id)}
          />
        </Suspense>
      </div>
      <div className="flex-1 flex flex-col h-full rounded-xl border border-border bg-white overflow-hidden">
        {invitationId == null ? (
          <JuryEmptySelection />
        ) : (
          <Suspense key={invitationId} fallback={<JuryInvitationDetailsSkeleton />}>
            <JuryInvitationDetailsContent
              invitationId={invitationId}
              onDeleted={() => void setInvitationId(null)}
            />
          </Suspense>
        )}
      </div>
      <JuryInvitationCreateSheet
        open={createSheetOpen}
        onOpenChange={setCreateSheetOpen}
        onInvitationCreated={(id) => void setInvitationId(id)}
      />
    </div>
  )
}
