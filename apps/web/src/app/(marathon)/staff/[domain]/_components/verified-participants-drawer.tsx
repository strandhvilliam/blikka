"use client"

import { useState } from "react"
import { CheckCircle2, ChevronRight, Loader2, SearchIcon, X } from "lucide-react"
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

function ParticipantRow({
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
      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-muted/40 active:bg-muted/60"
    >
      <span className="w-14 shrink-0 text-right font-mono text-sm text-muted-foreground">
        #{verification.participant.reference}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {verification.participant.firstname} {verification.participant.lastname}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {new Date(verification.createdAt).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
      {errors > 0 ? (
        <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
          {errors}
        </span>
      ) : warnings > 0 ? (
        <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
          {warnings}
        </span>
      ) : (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
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
          <div className="border-b bg-white px-5 pb-4 pt-6">
            <h2 className="font-gothic text-2xl font-medium tracking-tight">Verified</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {ownVerifications.length} verification{ownVerifications.length !== 1 ? "s" : ""}
            </p>
            <div className="relative mt-4">
              <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                className="h-11 rounded-full bg-muted/40 pl-11 pr-10"
                placeholder="Search by participant number"
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

          <div className="flex-1 overflow-y-auto px-2 py-3">
            {hasSearch ? (
              <div className="mb-4">
                <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  Search result
                </p>
                {isSearchLoading ? (
                  <div className="flex items-center justify-center px-3 py-6 text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Searching…
                  </div>
                ) : searchResult ? (
                  <ParticipantRow
                    verification={searchResult}
                    onClick={() => {
                      setSelectedParticipant(searchResult.participant)
                      setParticipantOpen(true)
                    }}
                  />
                ) : (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                    No verification found for #{searchQuery}.
                  </p>
                )}
                <div className="mx-3 border-b" />
              </div>
            ) : null}

            <div>
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                Your verifications
              </p>
              {ownVerifications.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  You have not verified any participants yet.
                </p>
              ) : (
                <div className="divide-y divide-border/50">
                  {ownVerifications.map((verification) => (
                    <ParticipantRow
                      key={verification.id}
                      verification={verification}
                      onClick={() => {
                        setSelectedParticipant(verification.participant)
                        setParticipantOpen(true)
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {hasNextPage ? (
              <div className="mt-4 flex justify-center pb-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={onFetchNextPage}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Loading…
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
