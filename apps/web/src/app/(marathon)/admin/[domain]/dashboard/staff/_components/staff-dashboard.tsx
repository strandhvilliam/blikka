"use client"

import { useState, Suspense } from "react"
import { parseAsString, useQueryState } from "nuqs"
import { PrimaryButton } from "@/components/ui/primary-button"
import { Users, Plus, User2Icon } from "lucide-react"
import { StaffAddDialog } from "./staff-add-dialog"
import { StaffList } from "./staff-list"
import { StaffListSkeleton } from "./staff-list-skeleton"
import { StaffDetailsContent } from "../[accessId]/_components/staff-details-content"
import { StaffDetailsSkeleton } from "../[accessId]/_components/staff-details-skeleton"

function StaffEmptySelection() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 py-8 text-muted-foreground">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-muted/50">
        <User2Icon className="h-7 w-7 text-muted-foreground/40" />
      </div>
      <h2 className="font-gothic mb-1.5 text-lg font-semibold text-foreground">No Staff Selected</h2>
      <p className="max-w-md text-center text-[13px] leading-relaxed text-muted-foreground/70">
        Select a staff member from the list to view their details, or add a new staff member to give
        them access to the standalone verification desk.
      </p>
    </div>
  )
}

export function StaffDashboard() {
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [access, setAccess] = useQueryState("access", parseAsString)

  return (
    <div className="mx-auto flex h-full w-full max-w-[1400px] flex-col px-4 py-3 sm:px-6 sm:py-4">
      <div className="mb-4 shrink-0 sm:mb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10">
                <Users className="h-[18px] w-[18px] text-brand-primary" strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                  Team
                </p>
                <h1 className="font-gothic text-2xl font-bold leading-none tracking-tight">Staff</h1>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Manage team members and verification desk access for this marathon
            </p>
          </div>
          <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
            <PrimaryButton
              onClick={() => setAddDialogOpen(true)}
              className="min-h-9 flex flex-1 items-center justify-center gap-1.5 text-xs sm:flex-initial"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span>Add Staff</span>
            </PrimaryButton>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-white md:flex-row">
        <div className="flex h-[min(42vh,300px)] shrink-0 flex-col overflow-hidden border-b border-border md:h-auto md:w-80 md:shrink-0 md:border-r md:border-b-0">
          <Suspense fallback={<StaffListSkeleton />}>
            <StaffList
              selectedAccessId={access ?? undefined}
              onSelectAccess={(id) => void setAccess(id)}
            />
          </Suspense>
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {access == null ? (
            <StaffEmptySelection />
          ) : (
            <Suspense key={access} fallback={<StaffDetailsSkeleton />}>
              <StaffDetailsContent accessId={access} onRemoved={() => void setAccess(null)} />
            </Suspense>
          )}
        </div>
      </div>

      <StaffAddDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onStaffCreated={(id) => void setAccess(id)}
      />
    </div>
  )
}
