"use client"

import { useEffect, useMemo, useState } from "react"
import { useInfiniteQuery, useQuery, useSuspenseQuery } from "@tanstack/react-query"
import {
  ChevronDownIcon,
  LogOutIcon,
  PenIcon,
  QrCodeIcon,
  ShieldCheckIcon,
  UploadIcon,
  UsersIcon,
} from "lucide-react"
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DotPattern } from "@/components/dot-pattern"

import { normalizeParticipantReference } from "../_lib/staff-utils"
import { StaffManualEntryDialog } from "./manual-entry-dialog"
import { ParticipantInfoDrawer } from "./participant-info-drawer"
import { QrScanDrawer } from "./qr-scan-drawer"
import { VerifiedParticipantsDrawer } from "./verified-participants-drawer"

function getInitials(name?: string | null, email?: string | null) {
  const source = (name || email || "Staff").trim()
  const words = source.split(/\s+/).filter(Boolean)

  if (words.length === 0) return "ST"
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()

  return words
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase()
}

interface StaffHomeClientProps {
  staffEmail?: string | null
  staffId: string
  staffImage?: string | null
  staffName?: string | null
}

export function StaffHomeClient({
  staffEmail,
  staffId,
  staffImage,
  staffName,
}: StaffHomeClientProps) {
  const domain = useDomain()
  const router = useRouter()
  const trpc = useTRPC()
  const [isLogoutLoading, setIsLogoutLoading] = useState(false)

  const [activeParticipantReference, setActiveParticipantReference] = useQueryState(
    "reference",
    parseAsString,
  )
  const [searchQuery, setSearchQuery] = useQueryState("vpg", parseAsString.withDefault(""))
  const [openSheet, setOpenSheet] = useQueryState(
    "sheet",
    parseAsStringEnum(["participant-info", "qr-scan", "manual-entry", "verified-list"]),
  )

  const [debouncedSearchQuery] = useDebounce(searchQuery, 300)

  const { data: marathon } = useSuspenseQuery(
    trpc.marathons.getByDomain.queryOptions({
      domain,
    }),
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
      },
    ),
  )

  const ownVerifications = useMemo(
    () => ownVerificationsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [ownVerificationsQuery.data],
  )

  const participantQuery = useQuery(
    trpc.participants.getByReference.queryOptions(
      {
        reference: activeParticipantReference ?? "",
        domain,
      },
      {
        enabled: Boolean(activeParticipantReference),
      },
    ),
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
      },
    ),
  )

  useEffect(() => {
    if (openSheet === "participant-info" && !activeParticipantReference) {
      void setOpenSheet(null)
    }
  }, [activeParticipantReference, openSheet, setOpenSheet])

  const openSheetSafely = async (
    target: "participant-info" | "qr-scan" | "manual-entry" | "verified-list",
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
      router.push(
        `/auth/login?next=${encodeURIComponent(formatDomainPathname("/staff", domain, "staff"))}`,
      )
    } catch (error) {
      console.error(error)
      toast.error("Failed to sign out")
    } finally {
      setIsLogoutLoading(false)
    }
  }

  const resolvedName = staffName?.trim() || staffEmail?.trim() || "Staff operator"

  return (
    <>
      <div className="relative flex h-dvh flex-col overflow-hidden bg-background">
        <DotPattern />

        <header className="relative z-10 flex items-center justify-between px-5 pt-4 pb-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background">
              <ShieldCheckIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight text-foreground">
                {marathon.name}
              </p>
              <p className="text-[11px] tracking-wide text-muted-foreground">Staff panel</p>
            </div>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 rounded-full border border-border bg-white/90 py-1.5 pl-1.5 pr-3 shadow-sm backdrop-blur-sm transition-colors hover:bg-white"
              >
                <Avatar className="h-7 w-7 ring-1 ring-border">
                  {staffImage ? <AvatarImage src={staffImage} alt={resolvedName} /> : null}
                  <AvatarFallback className="bg-muted text-[10px] font-semibold">
                    {getInitials(staffName, staffEmail)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-sm font-medium text-foreground sm:inline">
                  {resolvedName}
                </span>
                <ChevronDownIcon className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-3">
              <div className="flex items-center gap-3 pb-3">
                <Avatar className="h-9 w-9 ring-1 ring-border">
                  {staffImage ? <AvatarImage src={staffImage} alt={resolvedName} /> : null}
                  <AvatarFallback className="bg-muted text-xs font-semibold">
                    {getInitials(staffName, staffEmail)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{resolvedName}</p>
                  {staffEmail && staffEmail !== resolvedName ? (
                    <p className="truncate text-xs text-muted-foreground">{staffEmail}</p>
                  ) : null}
                </div>
              </div>
              <div className="border-t border-border pt-3">
                <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>
                    Active: <span className="font-medium text-foreground">{marathon.name}</span>
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() => void handleLogout()}
                  disabled={isLogoutLoading}
                >
                  <LogOutIcon className="h-3.5 w-3.5" />
                  {isLogoutLoading ? "Signing out..." : "Sign out"}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </header>

        <main className="relative z-10 flex flex-1 flex-col items-center justify-between px-5 pb-6 pt-2">
          <div className="flex w-full max-w-md flex-col items-center pt-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Staff verification
            </p>
            <h1 className="mt-2 font-rocgrotesk text-4xl font-extrabold leading-none tracking-tight text-foreground sm:text-5xl">
              Verify arrivals
            </h1>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground text-balance">
              Scan a QR code or enter a participant number to review and approve uploads.
            </p>
          </div>

          <div className="flex flex-col items-center gap-4 py-8">
            <PrimaryButton
              onClick={() => void openSheetSafely("qr-scan")}
              className="relative flex h-44 w-44 items-center justify-center rounded-full shadow-[0_16px_60px_rgba(254,57,35,0.18)] sm:h-52 sm:w-52"
            >
              <QrCodeIcon className="h-20 w-20 sm:h-24 sm:w-24" />
            </PrimaryButton>
            <span className="text-base font-semibold text-foreground">Scan participant QR</span>
          </div>

          <div className="w-full max-w-md">
            <div className="rounded-2xl border border-border bg-white/95 p-4 shadow-lg backdrop-blur-sm">
              <div className="grid grid-cols-3 gap-3">
                <ActionTile
                  icon={<PenIcon className="h-5 w-5" />}
                  label="Manual entry"
                  onClick={() => void openSheetSafely("manual-entry")}
                />
                <ActionTile
                  icon={<UploadIcon className="h-5 w-5" />}
                  label="Laptop upload"
                  onClick={() =>
                    router.push(formatDomainPathname("/staff/staff-upload", domain, "staff"))
                  }
                />
                <ActionTile
                  icon={<UsersIcon className="h-5 w-5" />}
                  label="Verified list"
                  onClick={() => void openSheetSafely("verified-list")}
                />
              </div>
            </div>
          </div>
        </main>
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

      <StaffManualEntryDialog
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

function ActionTile({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2.5 rounded-xl border border-transparent px-2 py-4 transition-all hover:border-border hover:bg-muted/50 active:scale-[0.97]"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-foreground/6 text-foreground">
        {icon}
      </div>
      <span className="text-xs font-medium text-foreground">{label}</span>
    </button>
  )
}
