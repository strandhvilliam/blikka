"use client"

import { useState } from "react"
import { CheckCircle2, Loader2, SearchIcon, Users2, X } from "lucide-react"
import type { Topic } from "@blikka/db"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DrawerLayout } from "./drawer-layout"
import { ParticipantInfoDrawer } from "./participant-info-drawer"
import type { StaffParticipant, StaffVerification } from "../_lib/staff-types"

interface VerifiedParticipantsDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ownVerifications: StaffVerification[]
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onFetchNextPage: () => void
  searchQuery: string
  onSearchChange: (value: string) => void
  searchResult: StaffVerification | null
  isSearchLoading: boolean
  topics: Topic[]
  currentStaffId: string
}

function ParticipantCard({
  verification,
  onClick,
}: {
  verification: StaffVerification
  onClick: () => void
}) {
  const warnings = verification.participant.validationResults.filter(
    (result) => result.outcome === "failed" && result.severity === "warning" && !result.overruled
  ).length
  const errors = verification.participant.validationResults.filter(
    (result) => result.outcome === "failed" && result.severity === "error" && !result.overruled
  ).length

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-3xl border bg-white/80 p-4 text-left shadow-sm transition hover:border-primary/30 hover:shadow-md"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            Verified{" "}
            {new Date(verification.createdAt).toLocaleString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          <p className="truncate font-medium">
            {verification.participant.firstname} {verification.participant.lastname}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">
              #{verification.participant.reference}
            </span>
            {errors > 0 ? (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">{errors} errors</span>
            ) : null}
            {warnings > 0 ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                {warnings} warnings
              </span>
            ) : null}
            {errors === 0 && warnings === 0 ? (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                Clean
              </span>
            ) : null}
          </div>
        </div>
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
      </div>
    </button>
  )
}

export function VerifiedParticipantsDrawer({
  open,
  onOpenChange,
  ownVerifications,
  hasNextPage,
  isFetchingNextPage,
  onFetchNextPage,
  searchQuery,
  onSearchChange,
  searchResult,
  isSearchLoading,
  topics,
  currentStaffId,
}: VerifiedParticipantsDrawerProps) {
  const [selectedParticipant, setSelectedParticipant] = useState<StaffParticipant | null>(null)
  const [participantOpen, setParticipantOpen] = useState(false)

  const hasSearch = searchQuery.trim().length > 0

  return (
    <>
      <DrawerLayout open={open} onOpenChange={onOpenChange} title="Verified participants">
        <div className="flex h-full flex-col">
          <div className="border-b bg-white/70 px-5 pb-4 pt-8 backdrop-blur-sm">
            <div className="mx-auto max-w-md text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border bg-background shadow-sm">
                <Users2 className="h-6 w-6 text-primary" />
              </div>
              <h2 className="mt-4 font-rocgrotesk text-3xl">Verified participants</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Search for any verified participant by number, or review your own verifications.
              </p>
            </div>
            <div className="relative mx-auto mt-5 max-w-md">
              <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                className="h-12 rounded-full bg-background pl-11 pr-10"
                placeholder="Enter participant number"
              />
              {searchQuery ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full"
                  onClick={() => onSearchChange("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {hasSearch ? (
              <div className="mb-6 space-y-3">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Search result
                </p>
                {isSearchLoading ? (
                  <div className="flex items-center justify-center rounded-3xl border bg-white/70 px-4 py-8">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Searching…
                  </div>
                ) : searchResult ? (
                  <ParticipantCard
                    verification={searchResult}
                    onClick={() => {
                      setSelectedParticipant(searchResult.participant)
                      setParticipantOpen(true)
                    }}
                  />
                ) : (
                  <div className="rounded-3xl border bg-white/70 px-4 py-8 text-center text-sm text-muted-foreground">
                    No verification found for #{searchQuery}.
                  </div>
                )}
              </div>
            ) : null}

            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Your verifications
              </p>
              {ownVerifications.length === 0 ? (
                <div className="rounded-3xl border bg-white/70 px-4 py-8 text-center text-sm text-muted-foreground">
                  You have not verified any participants yet.
                </div>
              ) : (
                ownVerifications.map((verification) => (
                  <ParticipantCard
                    key={verification.id}
                    verification={verification}
                    onClick={() => {
                      setSelectedParticipant(verification.participant)
                      setParticipantOpen(true)
                    }}
                  />
                ))
              )}
            </div>

            {hasNextPage ? (
              <div className="mt-5 flex justify-center">
                <Button variant="outline" onClick={onFetchNextPage} disabled={isFetchingNextPage}>
                  {isFetchingNextPage ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading more
                    </>
                  ) : (
                    "Load more"
                  )}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </DrawerLayout>

      <ParticipantInfoDrawer
        open={participantOpen}
        onOpenChange={setParticipantOpen}
        participant={selectedParticipant}
        participantLoading={false}
        topics={topics}
        currentStaffId={currentStaffId}
        readOnly={true}
      />
    </>
  )
}
