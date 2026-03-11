"use client"

import { useEffect, useMemo, useState } from "react"
import { useInfiniteQuery, useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { LogOutIcon, PenIcon, QrCodeIcon, UploadIcon, UsersIcon } from "lucide-react"
import { parseAsString, parseAsStringEnum, useQueryState } from "nuqs"
import { useDebounce } from "use-debounce"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import { useDomain } from "@/lib/domain-provider"
import { useTRPC } from "@/lib/trpc/client"
import { authClient } from "@/lib/auth/client"
import { formatDomainPathname } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { PrimaryButton } from "@/components/ui/primary-button"

import { normalizeParticipantReference } from "../_lib/staff-utils"
import { ManualEntryDialog } from "./manual-entry-dialog"
import { ParticipantInfoDrawer } from "./participant-info-drawer"
import { QrScanDrawer } from "./qr-scan-drawer"
import { VerifiedParticipantsDrawer } from "./verified-participants-drawer"

interface StaffHomeClientProps {
  staffId: string
  staffName?: string | null
}

export function StaffHomeClient({ staffId, staffName }: StaffHomeClientProps) {
  const domain = useDomain()
  const router = useRouter()
  const trpc = useTRPC()
  const [isLogoutLoading, setIsLogoutLoading] = useState(false)

  const [activeParticipantReference, setActiveParticipantReference] = useQueryState(
    "reference",
    parseAsString
  )
  const [searchQuery, setSearchQuery] = useQueryState("vpg", parseAsString.withDefault(""))
  const [openSheet, setOpenSheet] = useQueryState(
    "sheet",
    parseAsStringEnum(["participant-info", "qr-scan", "manual-entry", "verified-list"])
  )

  const [debouncedSearchQuery] = useDebounce(searchQuery, 300)

  const { data: marathon } = useSuspenseQuery(
    trpc.marathons.getByDomain.queryOptions({
      domain,
    })
  )

  const ownVerificationsQuery = useInfiniteQuery(
    trpc.users.getVerificationsByStaffId.infiniteQueryOptions(
      {
        staffId,
        domain,
        limit: 20,
      },
      {
        getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
      }
    )
  )

  const ownVerifications = useMemo(
    () => ownVerificationsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [ownVerificationsQuery.data]
  )

  const participantQuery = useQuery(
    trpc.participants.getByReference.queryOptions(
      {
        reference: activeParticipantReference ?? "",
        domain,
      },
      {
        enabled: Boolean(activeParticipantReference),
      }
    )
  )

  const normalizedSearchQuery = debouncedSearchQuery.trim()
    ? normalizeParticipantReference(debouncedSearchQuery)
    : ""

  const searchResultQuery = useQuery(
    trpc.validations.getParticipantVerificationByReference.queryOptions(
      {
        domain,
        reference: normalizedSearchQuery,
      },
      {
        enabled: normalizedSearchQuery.length > 0,
      }
    )
  )

  useEffect(() => {
    if (openSheet === "participant-info" && !activeParticipantReference) {
      void setOpenSheet(null)
    }
  }, [activeParticipantReference, openSheet, setOpenSheet])

  const openSheetSafely = async (
    target: "participant-info" | "qr-scan" | "manual-entry" | "verified-list"
  ) => {
    if (openSheet && openSheet !== target) {
      await setOpenSheet(null)
      window.setTimeout(() => {
        void setOpenSheet(target)
      }, 120)
      return
    }

    await setOpenSheet(target)
  }

  const handleLogout = async () => {
    try {
      setIsLogoutLoading(true)
      await authClient.signOut()
      router.push(`/auth/login?next=${encodeURIComponent(formatDomainPathname("/staff", domain, "staff"))}`)
    } catch (error) {
      console.error(error)
      toast.error("Failed to sign out")
    } finally {
      setIsLogoutLoading(false)
    }
  }

  return (
    <>
      <div className="relative flex h-[100dvh] flex-col justify-between overflow-hidden bg-[radial-gradient(circle_at_top,rgba(247,238,216,0.92),rgba(248,245,240,0.75)_30%,rgba(250,249,246,0.95)_65%)] px-6 pb-6 pt-4">
        <div className="pointer-events-none absolute inset-0 bg-[url('/noise.png')] opacity-[0.035]" />

        <div className="relative z-10 flex items-start justify-between gap-4">
          <Button
            variant="secondary"
            size="sm"
            className="rounded-full border bg-white/85 shadow-sm"
            onClick={() => void handleLogout()}
            disabled={isLogoutLoading}
          >
            {isLogoutLoading ? "Signing out..." : "Logout"}
            {!isLogoutLoading ? <LogOutIcon className="ml-1 h-4 w-4" /> : null}
          </Button>
          <div className="rounded-full border bg-white/75 px-4 py-2 text-right shadow-sm backdrop-blur-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{marathon.domain}</p>
            <p className="text-sm font-medium">{staffName ?? "Staff"}</p>
          </div>
        </div>

        <div className="relative z-10 flex flex-col items-center gap-4 text-center">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Staff verification</p>
            <h1 className="font-rocgrotesk text-5xl leading-none text-foreground">Verify arrivals</h1>
            <p className="max-w-sm text-sm text-muted-foreground">
              Scan a QR code or enter a participant number to review uploads and approve them.
            </p>
          </div>

          <div className="relative">
            <div className="absolute inset-0 scale-110 rounded-full bg-primary/10 blur-3xl" />
            <PrimaryButton
              onClick={() => void openSheetSafely("qr-scan")}
              className="relative flex h-56 w-56 items-center justify-center rounded-full border border-primary/15 bg-[linear-gradient(180deg,#27231c,#0f0e0c)] text-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
            >
              <QrCodeIcon className="h-24 w-24" />
            </PrimaryButton>
          </div>
          <span className="text-lg font-medium text-foreground">Scan participant QR code</span>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => void openSheetSafely("manual-entry")}
            className="flex flex-col items-center gap-3 rounded-[2rem] border bg-white/80 px-4 py-5 shadow-sm backdrop-blur-sm transition hover:border-primary/30 hover:shadow-md"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <PenIcon className="h-7 w-7" />
            </div>
            <div className="text-center">
              <p className="font-medium">Enter manually</p>
              <p className="text-xs text-muted-foreground">Type a participant number</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => router.push(formatDomainPathname("/staff/staff-upload", domain, "staff"))}
            className="flex flex-col items-center gap-3 rounded-[2rem] border bg-white/80 px-4 py-5 shadow-sm backdrop-blur-sm transition hover:border-primary/30 hover:shadow-md"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UploadIcon className="h-7 w-7" />
            </div>
            <div className="text-center">
              <p className="font-medium">Laptop upload</p>
              <p className="text-xs text-muted-foreground">Upload SD card files for a participant</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => void openSheetSafely("verified-list")}
            className="col-span-2 flex flex-col items-center gap-3 rounded-[2rem] border bg-white/80 px-4 py-5 shadow-sm backdrop-blur-sm transition hover:border-primary/30 hover:shadow-md"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UsersIcon className="h-7 w-7" />
            </div>
            <div className="text-center">
              <p className="font-medium">Verified list</p>
              <p className="text-xs text-muted-foreground">Search and review approved participants</p>
            </div>
          </button>
        </div>
      </div>

      <QrScanDrawer
        open={openSheet === "qr-scan"}
        onOpenChange={(open) => {
          if (!open) {
            void setOpenSheet(null)
          }
        }}
        currentDomain={domain}
        onScanAction={(args) => {
          void setActiveParticipantReference(args.reference)
          void openSheetSafely("participant-info")
        }}
      />

      <ManualEntryDialog
        open={openSheet === "manual-entry"}
        onOpenChange={(open) => {
          if (!open) {
            void setOpenSheet(null)
          }
        }}
        onEnterAction={(args) => {
          void setActiveParticipantReference(args.reference)
          void openSheetSafely("participant-info")
        }}
      />

      <VerifiedParticipantsDrawer
        open={openSheet === "verified-list"}
        onOpenChange={(open) => {
          if (!open) {
            void setOpenSheet(null)
          }
        }}
        ownVerifications={ownVerifications}
        hasNextPage={Boolean(ownVerificationsQuery.hasNextPage)}
        isFetchingNextPage={ownVerificationsQuery.isFetchingNextPage}
        onFetchNextPage={() => void ownVerificationsQuery.fetchNextPage()}
        searchQuery={searchQuery}
        onSearchChange={(value) => void setSearchQuery(value)}
        searchResult={searchResultQuery.data ?? null}
        isSearchLoading={searchResultQuery.isLoading}
        topics={marathon.topics}
        currentStaffId={staffId}
      />

      <ParticipantInfoDrawer
        open={openSheet === "participant-info"}
        onOpenChange={(open) => {
          if (!open) {
            void setOpenSheet(null)
          }
        }}
        participant={participantQuery.data ?? null}
        participantLoading={participantQuery.isLoading}
        topics={marathon.topics}
        currentStaffId={staffId}
        onParticipantVerified={() => {
          void ownVerificationsQuery.refetch()
        }}
        onParticipantRejected={() => {
          void setActiveParticipantReference(null)
        }}
      />
    </>
  )
}
