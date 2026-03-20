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
      <div className="relative flex h-full flex-col bg-black">
        <QrScanner onScan={handleScan} onError={console.error} />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative h-64 w-64 rounded-[2rem] border border-white/20">
            <div className="absolute left-0 top-0 h-10 w-10 rounded-tl-[1.5rem] border-l-4 border-t-4 border-white" />
            <div className="absolute right-0 top-0 h-10 w-10 rounded-tr-[1.5rem] border-r-4 border-t-4 border-white" />
            <div className="absolute bottom-0 left-0 h-10 w-10 rounded-bl-[1.5rem] border-b-4 border-l-4 border-white" />
            <div className="absolute bottom-0 right-0 h-10 w-10 rounded-br-[1.5rem] border-b-4 border-r-4 border-white" />
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-20 flex flex-col items-center gap-3 px-8 text-center text-white">
          <div className="rounded-full border border-white/20 bg-white/10 p-3 backdrop-blur-sm">
            <QrCodeIcon className="h-8 w-8" />
          </div>
          <div>
            <p className="font-rocgrotesk text-2xl">Scan participant QR code</p>
            <p className="text-sm text-white/70">
              Align the code inside the frame to open the record.
            </p>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-8 flex justify-center px-6">
          <Button
            variant="secondary"
            className="pointer-events-auto w-full max-w-xs"
            onClick={() => onOpenChange(false)}
          >
            Cancel scan
          </Button>
        </div>
      </div>
    </DrawerLayout>
  )
}
