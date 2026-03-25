"use client"

import { DashboardStatusDisplay, DashboardStatusDisplaySkeleton } from "./dashboard-status-display"
import { DomainSwitchDropdown } from "./domain-switch-dropdown"
import { LiveUploadQrDialog } from "./live-upload-qr-dialog"
import { Copy, ExternalLink, QrCode, Shield, Upload, Users } from "lucide-react"
import { Suspense, useState, type ComponentType, type ReactNode } from "react"
import { useDomain } from "@/lib/domain-provider"
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Link copied")
    } catch {
      toast.error("Could not copy link")
    }
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
            <button
              type="button"
              className={quickLinkMenuItemClass}
              onClick={() => void copyLink()}
            >
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

export function DashboardHeader() {
  const domain = useDomain()

  const staffSiteUrl = formatDomainLink(`/staff`, domain, "staff")
  const participantSiteUrl = formatDomainLink(`/live`, domain)
  const computerUploadSiteUrl = formatDomainLink(`/staff/staff-upload`, domain)

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
      <div className="flex h-14 items-center gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:max-w-xs">
          <Suspense fallback={<Skeleton className="h-9 w-full max-w-68 shrink-0 rounded-full" />}>
            <DomainSwitchDropdown />
          </Suspense>
        </div>
        <div className="flex items-center gap-2 ml-auto mr-4">
          <DashboardQuickLinkPopover
            onShowQr={openQr}
            config={{
              url: staffSiteUrl,
              icon: Shield,
              label: "Staff",
              qrHeading: "Staff site",
              qrDescription: staffQrDescription,
            }}
          />
          <DashboardQuickLinkPopover
            onShowQr={openQr}
            config={{
              url: participantSiteUrl,
              icon: Users,
              label: "Upload",
            }}
          />
          <DashboardQuickLinkPopover
            onShowQr={openQr}
            config={{
              url: computerUploadSiteUrl,
              icon: Upload,
              label: "Computer Upload",
              showQrOption: false,
            }}
          />
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
