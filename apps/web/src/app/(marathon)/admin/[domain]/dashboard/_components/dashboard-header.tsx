"use client"

import { DashboardStatusDisplay, DashboardStatusDisplaySkeleton } from "./dashboard-status-display"
import { DomainSwitchDropdown } from "./domain-switch-dropdown"
import { LiveUploadQrDialog } from "./live-upload-qr-dialog"
import { Copy, ExternalLink, MoreHorizontal, QrCode, Shield, Upload, Users } from "lucide-react"
import { Suspense, useState, type ComponentType, type ReactNode } from "react"
import { useDomain } from "@/lib/domain-provider"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDomainLink } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const quickLinkMenuItemClass = cn(
  "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-left text-sm outline-none",
  "hover:bg-accent hover:text-accent-foreground",
  "focus-visible:bg-accent focus-visible:text-accent-foreground",
)

type QuickLinkConfig = {
  url: string
  icon: ComponentType<{ className?: string }>
  label: string
  showQrOption?: boolean
  qrHeading?: string
  qrDescription?: ReactNode
}

type QrDialogState = {
  url: string
  qrHeading?: string
  qrDescription?: ReactNode
}

async function copyQuickLinkUrl(url: string) {
  try {
    await navigator.clipboard.writeText(url)
    toast.success("Link copied")
  } catch {
    toast.error("Could not copy link")
  }
}

function MobileQuickLinkRow({
  config,
  onShowQr,
  onClose,
}: {
  config: QuickLinkConfig
  onShowQr: (state: QrDialogState) => void
  onClose: () => void
}) {
  const { url, icon: Icon, label, showQrOption = true } = config

  const openInNewTab = () => {
    window.open(url, "_blank", "noopener,noreferrer")
    onClose()
  }

  const handleShowQr = () => {
    onShowQr({ url, qrHeading: config.qrHeading, qrDescription: config.qrDescription })
    onClose()
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors active:bg-muted/80 hover:bg-muted hover:text-foreground"
          onClick={openInNewTab}
          aria-label={`Open ${label} in new tab`}
        >
          <ExternalLink className="size-3.5" />
        </button>
        {showQrOption && (
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors active:bg-muted/80 hover:bg-muted hover:text-foreground"
            onClick={handleShowQr}
            aria-label={`Show QR code for ${label}`}
          >
            <QrCode className="size-3.5" />
          </button>
        )}
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors active:bg-muted/80 hover:bg-muted hover:text-foreground"
          onClick={() => void copyQuickLinkUrl(url)}
          aria-label={`Copy ${label} link`}
        >
          <Copy className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

function DashboardQuickLinkPopover({
  config,
  onShowQr,
}: {
  config: QuickLinkConfig
  onShowQr: (state: QrDialogState) => void
}) {
  const { url, icon: Icon, label, showQrOption = true } = config

  const openInNewTab = () => {
    window.open(url, "_blank", "noopener,noreferrer")
  }

  const copyLink = async () => {
    await copyQuickLinkUrl(url)
  }

  const handleShowQr = () => {
    onShowQr({
      url: config.url,
      qrHeading: config.qrHeading,
      qrDescription: config.qrDescription,
    })
  }

  return (
    <Popover>
      <PopoverTrigger
        type="button"
        className={cn(
          "group inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium select-none",
          "border border-border/60 bg-sidebar-accent/50 text-sidebar-foreground/80",
          "transition-all duration-150 outline-none",
          "hover:bg-sidebar-accent hover:text-sidebar-foreground hover:border-border hover:shadow-xs",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
          "data-[state=open]:border-border data-[state=open]:bg-sidebar-accent",
        )}
      >
        <Icon className="size-3.5 opacity-60 group-hover:opacity-100 group-data-[state=open]:opacity-100 transition-opacity duration-150" />
        <span>{label}</span>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="end" sideOffset={6}>
        <div className="flex flex-col gap-0.5">
          <PopoverClose asChild>
            <button type="button" className={quickLinkMenuItemClass} onClick={openInNewTab}>
              <ExternalLink className="size-4 shrink-0 opacity-70" />
              Open in new tab
            </button>
          </PopoverClose>
          {showQrOption ? (
            <PopoverClose asChild>
              <button type="button" className={quickLinkMenuItemClass} onClick={handleShowQr}>
                <QrCode className="size-4 shrink-0 opacity-70" />
                Show QR-Code
              </button>
            </PopoverClose>
          ) : null}
          <PopoverClose asChild>
            <button type="button" className={quickLinkMenuItemClass} onClick={() => void copyLink()}>
              <Copy className="size-4 shrink-0 opacity-70" />
              Copy Link
            </button>
          </PopoverClose>
        </div>
      </PopoverContent>
    </Popover>
  )
}

const staffQrDescription = (
  <>
    This QR encodes the staff site URL for this marathon. Share only with people who should access
    staff tools and uploads.
  </>
)

function DashboardMobileDrawer({
  domain,
  quickLinkConfigs,
  onShowQr,
}: {
  domain: string
  quickLinkConfigs: QuickLinkConfig[]
  onShowQr: (state: QrDialogState) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "size-10 shrink-0 touch-manipulation rounded-lg border border-border/60 bg-sidebar-accent/70 p-0 text-sidebar-foreground",
            "hover:bg-sidebar-accent hover:text-sidebar-foreground hover:border-border active:scale-[0.98]",
            "[&_svg]:size-4.5 [&_svg]:opacity-90",
          )}
          aria-label="Marathon menu"
        >
          <MoreHorizontal />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="px-4 pb-8 pt-2">
        <DrawerTitle className="sr-only">Marathon menu</DrawerTitle>
        <div className="flex flex-col gap-5 pt-3">
          <section className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Marathon
            </p>
            <Suspense fallback={<Skeleton className="h-10 w-full rounded-full" />}>
              <DomainSwitchDropdown />
            </Suspense>
          </section>

          <section className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Quick links
            </p>
            <div className="flex flex-col gap-2">
              {quickLinkConfigs.map((config) => (
                <MobileQuickLinkRow
                  key={config.label}
                  config={config}
                  onShowQr={onShowQr}
                  onClose={() => setOpen(false)}
                />
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Status
            </p>
            <Suspense fallback={<DashboardStatusDisplaySkeleton />}>
              <DashboardStatusDisplay domain={domain} interactionMode="tap" />
            </Suspense>
          </section>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

export function DashboardHeader() {
  const domain = useDomain()

  const staffSiteUrl = formatDomainLink(`/staff`, domain, "staff")
  const participantSiteUrl = formatDomainLink(`/live`, domain)
  const computerUploadSiteUrl = formatDomainLink(`/staff/staff-upload`, domain)

  const quickLinkConfigs: QuickLinkConfig[] = [
    {
      url: staffSiteUrl,
      icon: Shield,
      label: "Staff",
      qrHeading: "Staff site",
      qrDescription: staffQrDescription,
    },
    {
      url: participantSiteUrl,
      icon: Users,
      label: "Upload",
    },
    {
      url: computerUploadSiteUrl,
      icon: Upload,
      label: "Computer Upload",
      showQrOption: false,
    },
  ]

  const [qrOpen, setQrOpen] = useState(false)
  const [qrDialog, setQrDialog] = useState<QrDialogState | null>(null)

  const openQr = (state: QrDialogState) => {
    setQrDialog(state)
    setQrOpen(true)
  }

  const handleQrOpenChange = (open: boolean) => {
    setQrOpen(open)
  }

  return (
    <div className="z-50 w-full pr-4 bg-sidebar">
      <div className="grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 py-1.5 pl-3 md:hidden">
        <div className="flex items-center justify-start">
          <SidebarTrigger
            className={cn(
              "size-10 shrink-0 touch-manipulation rounded-lg border border-border/60 bg-sidebar-accent/70 p-0 text-sidebar-foreground",
              "hover:bg-sidebar-accent hover:text-sidebar-foreground hover:border-border active:scale-[0.98]",
              "[&_svg]:size-4.5 [&_svg]:opacity-90",
            )}
          />
        </div>
        <div className="flex min-w-0 items-center justify-center px-1">
          <Suspense fallback={<DashboardStatusDisplaySkeleton />}>
            <DashboardStatusDisplay domain={domain} interactionMode="tap" />
          </Suspense>
        </div>
        <div className="flex items-center justify-end">
          <DashboardMobileDrawer
            domain={domain}
            quickLinkConfigs={quickLinkConfigs}
            onShowQr={openQr}
          />
        </div>
      </div>

      <div className="hidden md:flex md:h-14 md:flex-row md:items-center md:gap-4 md:py-0">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:max-w-xs">
          <Suspense fallback={<Skeleton className="h-9 w-full max-w-68 shrink-0 rounded-full" />}>
            <DomainSwitchDropdown />
          </Suspense>
        </div>
        <div className="flex items-center gap-2 ml-auto mr-4">
          {quickLinkConfigs.map((config) => (
            <DashboardQuickLinkPopover key={config.label} onShowQr={openQr} config={config} />
          ))}
        </div>
        <Suspense fallback={<DashboardStatusDisplaySkeleton />}>
          <DashboardStatusDisplay domain={domain} />
        </Suspense>
      </div>
      {qrDialog ? (
        <LiveUploadQrDialog
          key={qrDialog.url}
          uploadUrl={qrDialog.url}
          open={qrOpen}
          onOpenChange={handleQrOpenChange}
          heading={qrDialog.qrHeading}
          description={qrDialog.qrDescription}
        />
      ) : null}
    </div>
  )
}
