'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Check, Copy, Download, XIcon } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { downloadQrPng } from '../_lib/download-qr-png'
import { QrCodeGenerator } from '@/components/qr-code-generator'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  type LiveParticipationMode,
  withLiveParticipationMode,
} from '@/lib/flow/live-participation-mode'
import { cn } from '@/lib/utils'

const defaultParticipantDescription = (
  <>
    This QR code and URL point at your marathon&apos;s{' '}
    <span className="font-medium text-brand-black/85 dark:text-foreground">live</span> site — the
    page participants open in a browser to register and upload their photos during the event. Share
    it on a poster, slide, or chat, or open{' '}
    <span className="font-medium text-brand-black/85 dark:text-foreground">Upload</span> in the
    header for the same address.
  </>
)

const MODE_PRESELECT_OPTIONS = [
  {
    value: 'none',
    label: 'No preselection',
    description: 'Participant chooses upload or crew registration',
  },
  {
    value: 'upload',
    label: 'Device upload',
    description: 'Skip choice and start phone/device upload',
  },
  {
    value: 'prepare',
    label: 'Crew upload',
    description: 'Skip choice and register for crew/SD-card upload',
  },
] as const

type ModePreselectValue = (typeof MODE_PRESELECT_OPTIONS)[number]['value']

function toLiveParticipationMode(value: ModePreselectValue): LiveParticipationMode | null {
  return value === 'none' ? null : value
}

export interface LiveUploadQrDialogProps {
  uploadUrl: string
  open: boolean
  onOpenChange: (open: boolean) => void
  heading?: string
  description?: ReactNode
  /** When true, show a control to optionally preselect live participation mode (`?mode=`). */
  showParticipationModeControl?: boolean
}

export function LiveUploadQrDialog({
  uploadUrl,
  open,
  onOpenChange,
  heading = 'Participant upload link',
  description = defaultParticipantDescription,
  showParticipationModeControl = false,
}: LiveUploadQrDialogProps) {
  const [copied, setCopied] = useState(false)
  const [modePreselect, setModePreselect] = useState<ModePreselectValue>('none')

  useEffect(() => {
    if (!open) {
      setModePreselect('none')
      setCopied(false)
    }
  }, [open])

  const effectiveUploadUrl = showParticipationModeControl
    ? withLiveParticipationMode(uploadUrl, toLiveParticipationMode(modePreselect))
    : uploadUrl

  const handleCopy = async () => {
    await navigator.clipboard.writeText(effectiveUploadUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Local portal + flex center: shared DialogContent uses zoom-in-95 which overwrites translate-based centering. */}
      <DialogPortal>
        <DialogOverlay />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
          <DialogPrimitive.Content
            className={cn(
              'pointer-events-auto relative z-50 grid w-full max-w-[calc(100%-2rem)] gap-4 rounded-lg border shadow-lg duration-200',
              'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
              'max-h-[min(90dvh,calc(100dvh-2rem))] max-w-4xl gap-0 overflow-x-hidden overflow-y-auto border-brand-black/10 bg-brand-white p-0',
              'shadow-[0_24px_70px_rgba(0,0,0,0.14)] sm:max-w-4xl dark:border-white/12 dark:bg-card dark:shadow-[0_24px_70px_rgba(0,0,0,0.45)]',
            )}
          >
            <DialogHeader className="sr-only">
              <DialogTitle>QR code for {heading}</DialogTitle>
              <DialogDescription>
                Scannable QR code and shareable URL for this marathon link.
              </DialogDescription>
            </DialogHeader>
            <LiveUploadQrDialogBody
              uploadUrl={effectiveUploadUrl}
              onCopy={handleCopy}
              copied={copied}
              heading={heading}
              description={description}
              showParticipationModeControl={showParticipationModeControl}
              modePreselect={modePreselect}
              onModePreselectChange={setModePreselect}
            />
            <DialogPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 z-10 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4">
              <XIcon />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </div>
      </DialogPortal>
    </Dialog>
  )
}

export function LiveUploadQrDialogBody({
  uploadUrl,
  onCopy,
  copied = false,
  heading = 'Participant upload link',
  description = defaultParticipantDescription,
  showParticipationModeControl = false,
  modePreselect = 'none',
  onModePreselectChange,
}: Omit<LiveUploadQrDialogProps, 'open' | 'onOpenChange'> & {
  onCopy?: () => void | Promise<void>
  copied?: boolean
  modePreselect?: ModePreselectValue
  onModePreselectChange?: (value: ModePreselectValue) => void
}) {
  const qrCodeRef = useRef<HTMLDivElement>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownload = async () => {
    setDownloadError(null)
    setIsDownloading(true)

    try {
      const svg = qrCodeRef.current?.querySelector('svg')

      await downloadQrPng({
        filename: 'live-upload-qr.png',
        svg: svg ?? null,
      })
    } catch (error) {
      console.error('Failed to download live upload QR code', error)
      setDownloadError('Could not download the QR code. Please try again.')
    } finally {
      setIsDownloading(false)
    }
  }

  const selectedOption =
    MODE_PRESELECT_OPTIONS.find((option) => option.value === modePreselect) ??
    MODE_PRESELECT_OPTIONS[0]

  return (
    <div className="relative flex flex-col gap-8 p-6 sm:gap-10 sm:p-10">
      <header className="pr-10">
        <h2 className="font-special-gothic text-balance text-3xl leading-[0.95] tracking-tight text-brand-black sm:text-4xl dark:text-card-foreground">
          {heading}
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-brand-black/70 dark:text-muted-foreground">
          {description}
        </p>
      </header>

      {showParticipationModeControl ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-sm font-medium text-brand-black dark:text-card-foreground">
              Preselected upload mode
            </Label>
            <p className="text-sm leading-relaxed text-brand-black/60 dark:text-muted-foreground">
              Optional. Classic marathon only — when set, scanning skips the upload-choice dialog.
            </p>
          </div>
          <ToggleGroup
            type="single"
            value={modePreselect}
            onValueChange={(value) => {
              if (!value) return
              onModePreselectChange?.(value as ModePreselectValue)
            }}
            variant="outline"
            spacing={2}
            className="flex w-full flex-col sm:flex-row"
          >
            {MODE_PRESELECT_OPTIONS.map((option) => (
              <ToggleGroupItem
                key={option.value}
                value={option.value}
                className="h-auto min-h-10 flex-1 justify-start whitespace-normal rounded-md px-3 py-2.5 text-left"
                aria-label={option.label}
              >
                <span className="flex flex-col items-start gap-0.5">
                  <span className="text-sm font-medium">{option.label}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {option.description}
                  </span>
                </span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <p className="text-xs text-brand-black/55 dark:text-muted-foreground">
            Current link uses: {selectedOption.label}
            {modePreselect !== 'none' ? ` (?mode=${modePreselect})` : ''}
          </p>
        </div>
      ) : null}

      <div className="relative rounded-2xl border border-brand-black/10 bg-white p-5 shadow-[0_14px_38px_rgba(0,0,0,0.08)] sm:p-8 dark:border-white/10 dark:bg-card/80 dark:shadow-[0_14px_38px_rgba(0,0,0,0.35)]">
        <div
          ref={qrCodeRef}
          className="mx-auto flex w-full max-w-[min(80vw,34rem)] justify-center [&_svg]:h-auto [&_svg]:max-w-full"
        >
          <QrCodeGenerator value={uploadUrl} size={512} />
        </div>
      </div>
      <div className="flex flex-col items-center gap-3">
        <div className="flex w-full flex-col justify-center gap-3 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={handleDownload}
            disabled={isDownloading}
            className="min-w-44 gap-2 rounded-full border-brand-black/15 bg-white text-brand-black shadow-none hover:bg-brand-black/[0.04] dark:border-white/15 dark:bg-card dark:text-foreground dark:hover:bg-white/8"
          >
            <Download className="size-4" />
            <span>{isDownloading ? 'Preparing PNG...' : 'Download PNG'}</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onCopy}
            className="min-w-44 gap-2 rounded-full border-brand-black/15 bg-white text-brand-black shadow-none hover:bg-brand-black/[0.04] dark:border-white/15 dark:bg-card dark:text-foreground dark:hover:bg-white/8"
          >
            {copied ? <Check className="size-4 text-brand-primary" /> : <Copy className="size-4" />}
            <span>{copied ? 'Copied' : 'Copy link'}</span>
          </Button>
        </div>
        {downloadError ? (
          <p className="text-center text-sm text-brand-black/60 dark:text-muted-foreground">
            {downloadError}
          </p>
        ) : null}
      </div>
    </div>
  )
}
