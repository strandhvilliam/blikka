"use client"

import dynamic from "next/dynamic"
import { QrCodeIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { DrawerLayout } from "./drawer-layout"

const QrScanner = dynamic(() => import("./qr-scanner").then((mod) => mod.QrScanner), {
  ssr: false,
})

interface QrScanDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentDomain: string
  onScanAction: (args: { reference: string }) => void
}

export function QrScanDrawer({
  open,
  onOpenChange,
  currentDomain,
  onScanAction,
}: QrScanDrawerProps) {
  const handleScan = (data: string | null) => {
    if (!data) {
      toast.error("No QR code detected")
      return
    }

    const [domain, _participantId, reference] = data.split("-")

    if (!domain || !reference) {
      toast.error("Invalid QR code")
      return
    }

    if (domain !== currentDomain) {
      toast.error("This QR code belongs to another marathon")
      return
    }

    onOpenChange(false)
    onScanAction({ reference })
  }

  return (
    <DrawerLayout open={open} onOpenChange={onOpenChange} title="Scan participant QR code">
      <div className="relative flex h-full min-h-0 flex-col bg-black">
        <div className="pointer-events-none z-10 flex shrink-0 flex-col items-center gap-3 px-6 pb-3 pt-12 text-center text-white sm:px-8 sm:pb-4 sm:pt-14">
          <div className="rounded-full border border-white/20 bg-white/10 p-3 backdrop-blur-sm">
            <QrCodeIcon className="h-8 w-8" />
          </div>
          <div className="max-w-md">
            <p className="font-gothic text-2xl font-medium">Scan participant QR code</p>
            <p className="text-sm text-white/70">
              Align the code inside the frame to open the record.
            </p>
          </div>
        </div>

        <div className="relative min-h-0 flex-1">
          <QrScanner onScan={handleScan} onError={console.error} />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 py-2">
            <div className="relative h-64 w-64 rounded-[2rem] border border-white/20">
              <div className="absolute left-0 top-0 h-10 w-10 rounded-tl-[1.5rem] border-l-4 border-t-4 border-white" />
              <div className="absolute right-0 top-0 h-10 w-10 rounded-tr-[1.5rem] border-r-4 border-t-4 border-white" />
              <div className="absolute bottom-0 left-0 h-10 w-10 rounded-bl-[1.5rem] border-b-4 border-l-4 border-white" />
              <div className="absolute bottom-0 right-0 h-10 w-10 rounded-br-[1.5rem] border-b-4 border-r-4 border-white" />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 justify-center px-6 pb-8 pt-2">
          <Button
            variant="secondary"
            className="w-full max-w-xs"
            onClick={() => onOpenChange(false)}
          >
            Cancel scan
          </Button>
        </div>
      </div>
    </DrawerLayout>
  )
}
