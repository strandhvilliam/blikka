"use client"

import { useState } from "react"
import { PrimaryButton } from "@/components/ui/primary-button"
import { Plus } from "lucide-react"
import { JuryInvitationCreateSheet } from "./jury-create-sheet"

interface JuryLayoutContentProps {
  children: React.ReactNode
}

export function JuryLayoutContent({ children }: JuryLayoutContentProps) {
  const [createSheetOpen, setCreateSheetOpen] = useState(false)

  // Split children into list and content
  const childrenArray = Array.isArray(children) ? children : [children]
  const listComponent = childrenArray[0]
  const contentComponent = childrenArray[1]

  return (
    <div className="flex h-full bg-muted/30 gap-6 max-w-[1800px] mx-auto">
      <div className="w-80 bg-background flex flex-col border border-border/70 rounded-lg shadow-sm overflow-hidden">
        <div className="border-b border-border/40">
          <div className="flex items-center justify-between p-4">
            <h2 className="text-lg font-semibold font-gothic">Jury Invitations</h2>
            <PrimaryButton onClick={() => setCreateSheetOpen(true)}>
              <Plus className="h-4 w-4" />
            </PrimaryButton>
          </div>
          {listComponent}
        </div>
      </div>
      <div className="flex-1 flex flex-col h-full bg-background border border-border/70 rounded-lg shadow-sm overflow-hidden">
        {contentComponent}
      </div>
      <JuryInvitationCreateSheet open={createSheetOpen} onOpenChange={setCreateSheetOpen} />
    </div>
  )
}

