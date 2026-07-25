'use client'

import { useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { QrCodeIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { DrawerLayout } from '@/components/staff/drawer-layout'
import { parseParticipantQrValue } from '@/lib/staff/participant-qr'

const QrScanner = dynamic(
  () => import('@/components/staff/qr-scanner').then((mod) => mod.QrScanner),
  {
    ssr: false,
  },
)

interface QrScanDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentDomain: string
  onScanAction: (args: { reference: string }) => void
}

/** Shared toast id so a camera that errors on every frame replaces its toast, not stacks it. */
const SCANNER_TOAST_ID = 'staff-qr-scanner'

export function QrScanDrawer({
  open,
  onOpenChange,
  currentDomain,
  onScanAction,
}: QrScanDrawerProps) {
  /**
   * The scanner keeps decoding while the sheet animates out, so without this a single
   * held-up code fires `onScanAction` several times.
   */
  const hasAcceptedScan = useRef(false)

  useEffect(() => {
    if (open) {
      hasAcceptedScan.current = false
    }
  }, [open])

  const handleScan = (data: string | null) => {
    if (hasAcceptedScan.current) return

    if (!data) {
      toast.error('No QR code detected', { id: SCANNER_TOAST_ID })
      return
    }

    const payload = parseParticipantQrValue(data)

    if (!payload) {
      toast.error('Invalid QR code', { id: SCANNER_TOAST_ID })
      return
    }

    if (payload.domain !== currentDomain) {
      toast.error('This QR code belongs to another marathon', { id: SCANNER_TOAST_ID })
      return
    }

    hasAcceptedScan.current = true
    onOpenChange(false)
    onScanAction({ reference: payload.reference })
  }

  const handleScannerError = (error: Error) => {
    console.error(error)

    // Without this the sheet is just a black rectangle — the most likely failure on a
    // phone (permission denied, camera already in use) with nothing telling staff why.
    const isPermissionError = error.name === 'NotAllowedError' || error.name === 'SecurityError'

    toast.error(
      isPermissionError
        ? 'Camera access is blocked. Allow it in your browser settings, or use manual entry.'
        : 'Could not start the camera. Use manual entry instead.',
      { id: SCANNER_TOAST_ID },
    )
  }

  return (
    <DrawerLayout
      open={open}
      onOpenChange={onOpenChange}
      title="Scan participant QR code"
      contentClassName="bg-black"
      dragHandleClassName="mt-2 bg-white/35"
    >
      <div className="absolute inset-0 z-0 min-h-0 overflow-hidden bg-black">
        <div className="absolute inset-0 z-0">
          <QrScanner onScan={handleScan} onError={handleScannerError} />
        </div>

        <div className="absolute inset-0 z-10 flex flex-col pointer-events-none">
          <div className="shrink-0 px-6 pb-3 pt-12 text-center text-white sm:px-8 sm:pb-4 sm:pt-14">
            <div className="mx-auto flex max-w-md flex-col items-center gap-3">
              <div className="rounded-full border border-white/20 bg-white/10 p-3 backdrop-blur-sm">
                <QrCodeIcon className="h-8 w-8" />
              </div>
              <div>
                <p className="font-gothic text-2xl font-medium">Scan participant QR code</p>
                <p className="text-sm text-white/70">
                  Align the code inside the frame to open the record.
                </p>
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-2">
            <div className="relative h-64 w-64 rounded-[2rem] border border-white/20">
              <div className="absolute left-0 top-0 h-10 w-10 rounded-tl-[1.5rem] border-l-4 border-t-4 border-white" />
              <div className="absolute right-0 top-0 h-10 w-10 rounded-tr-[1.5rem] border-r-4 border-t-4 border-white" />
              <div className="absolute bottom-0 left-0 h-10 w-10 rounded-bl-[1.5rem] border-b-4 border-l-4 border-white" />
              <div className="absolute bottom-0 right-0 h-10 w-10 rounded-br-[1.5rem] border-b-4 border-r-4 border-white" />
            </div>
          </div>

          <div className="flex shrink-0 justify-center px-6 pb-8 pt-2">
            <Button
              variant="secondary"
              className="pointer-events-auto w-full max-w-xs"
              onClick={() => onOpenChange(false)}
            >
              Cancel scan
            </Button>
          </div>
        </div>
      </div>
    </DrawerLayout>
  )
}
