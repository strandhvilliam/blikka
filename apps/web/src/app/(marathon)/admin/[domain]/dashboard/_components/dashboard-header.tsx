"use client"

import { DashboardStatusDisplay, DashboardStatusDisplaySkeleton } from "./dashboard-status-display"
import { DomainSwitchDropdown } from "./domain-switch-dropdown"
import { LiveUploadQrDialog } from "./live-upload-qr-dialog"
import Link from "next/link"
import { ExternalLink, Users, Shield, Upload } from "lucide-react"
import { Suspense } from "react"
import { useDomain } from "@/lib/domain-provider"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDomainLink } from "@/lib/utils"
import { cn } from "@/lib/utils"

function QuickNavLink({
  href,
  icon: Icon,
  label,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium select-none",
        "border border-border/60 bg-sidebar-accent/50 text-sidebar-foreground/80",
        "transition-all duration-150",
        "hover:bg-sidebar-accent hover:text-sidebar-foreground hover:border-border hover:shadow-xs",
      )}
    >
      <Icon className="size-3.5 opacity-60 group-hover:opacity-100 transition-opacity duration-150" />
      <span>{label}</span>
      <ExternalLink className="size-3 opacity-0 -ml-0.5 group-hover:opacity-50 transition-opacity duration-150" />
    </Link>
  )
}

export function DashboardHeader() {
  const domain = useDomain()

  const staffSiteUrl = formatDomainLink(`/staff`, domain, "staff")
  const participantSiteUrl = formatDomainLink(`/live`, domain)
  const computerUploadSiteUrl = formatDomainLink(`/staff/staff-upload`, domain)

  return (
    <div className="z-50 w-full pr-4 bg-sidebar">
      <div className="flex h-14 items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-64">
            <Suspense fallback={<Skeleton className="h-10 w-64" />}>
              <DomainSwitchDropdown />
            </Suspense>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto mr-4">
          <QuickNavLink href={staffSiteUrl} icon={Shield} label="Staff" />
          <QuickNavLink href={participantSiteUrl} icon={Users} label="Upload" />
          <LiveUploadQrDialog uploadUrl={participantSiteUrl} />
          <QuickNavLink href={computerUploadSiteUrl} icon={Upload} label="Computer Upload" />
        </div>
        <Suspense fallback={<DashboardStatusDisplaySkeleton />}>
          <DashboardStatusDisplay domain={domain} />
        </Suspense>
      </div>
    </div>
  )
}
