"use client"

import { useState } from "react"
import { PrimaryButton } from "@/components/ui/primary-button"
import { Mail, Plus } from "lucide-react"
import { JuryInvitationCreateSheet } from "./jury-create-sheet"

interface JuryLayoutContentProps {
  children: React.ReactNode
}

export function JuryLayoutContent({ children }: JuryLayoutContentProps) {
  const [createSheetOpen, setCreateSheetOpen] = useState(false)

  const childrenArray = Array.isArray(children) ? children : [children]
  const listComponent = childrenArray[0]
  const contentComponent = childrenArray[1]

  return (
    <div className="flex h-full gap-5 mx-auto max-w-[1600px] p-6">
      <div className="w-80 shrink-0 flex flex-col rounded-xl border border-border bg-white overflow-hidden">
        <div className="border-b border-border px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary/10">
                <Mail className="h-4 w-4 text-brand-primary" strokeWidth={1.8} />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                  Evaluation
                </p>
                <h1 className="text-lg font-bold tracking-tight font-gothic leading-none">
                  Jury Invitations
                </h1>
              </div>
            </div>
            <PrimaryButton onClick={() => setCreateSheetOpen(true)} className="h-8 w-8 p-0">
              <Plus className="h-4 w-4" />
            </PrimaryButton>
          </div>
        </div>
        {listComponent}
      </div>
      <div className="flex-1 flex flex-col h-full rounded-xl border border-border bg-white overflow-hidden">
        {contentComponent}
      </div>
      <JuryInvitationCreateSheet open={createSheetOpen} onOpenChange={setCreateSheetOpen} />
    </div>
  )
}
