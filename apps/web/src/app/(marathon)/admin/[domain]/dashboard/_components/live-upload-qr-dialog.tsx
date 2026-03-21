"use client"

import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Check, Copy, QrCode, XIcon } from "lucide-react"
import { useState } from "react"
import { QrCodeGenerator } from "@/app/(marathon)/live/[domain]/_components/qr-code-generator"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface LiveUploadQrDialogProps {
  uploadUrl: string
}

export function LiveUploadQrDialog({ uploadUrl }: LiveUploadQrDialogProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(uploadUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full border-border/60 bg-sidebar-accent/50 text-sidebar-foreground/80 shadow-none hover:bg-sidebar-accent hover:text-sidebar-foreground"
          aria-label="Show QR code and link for the participant live upload site"
        >
          <QrCode className="size-4 opacity-70" />
          <span>QR</span>
        </Button>
      </DialogTrigger>
      {/* Local portal + flex center: shared DialogContent uses zoom-in-95 which overwrites translate-based centering. */}
      <DialogPortal>
        <DialogOverlay />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
          <DialogPrimitive.Content
            className={cn(
              "pointer-events-auto relative z-50 grid w-full max-w-[calc(100%-2rem)] gap-4 rounded-lg border shadow-lg duration-200",
              "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              "max-h-[min(90dvh,calc(100dvh-2rem))] max-w-4xl gap-0 overflow-x-hidden overflow-y-auto border-brand-black/10 bg-brand-white p-0",
              "shadow-[0_24px_70px_rgba(0,0,0,0.14)] sm:max-w-4xl dark:border-white/12 dark:bg-card dark:shadow-[0_24px_70px_rgba(0,0,0,0.45)]",
            )}
          >
            <DialogHeader className="sr-only">
              <DialogTitle>QR code for the participant live upload site</DialogTitle>
              <DialogDescription>
                Opens the public live upload address for this marathon in a browser, where
                participants enter their details and submit photos. Same URL as the Upload
                shortcut in the header.
              </DialogDescription>
            </DialogHeader>
            <LiveUploadQrDialogBody uploadUrl={uploadUrl} onCopy={handleCopy} copied={copied} />
            <DialogPrimitive.Close
              className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 z-10 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
            >
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
}: LiveUploadQrDialogProps & {
  onCopy?: () => void | Promise<void>
  copied?: boolean
}) {
  return (
    <div className="relative flex flex-col gap-8 p-6 sm:gap-10 sm:p-10">
      <header className="pr-10">
        <h2 className="font-special-gothic text-balance text-3xl leading-[0.95] tracking-tight text-brand-black sm:text-4xl dark:text-card-foreground">
          Participant upload link
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-brand-black/70 dark:text-muted-foreground">
          This QR code and URL point at your marathon&apos;s{" "}
          <span className="font-medium text-brand-black/85 dark:text-foreground">live</span> site —
          the page participants open in a browser to register and upload their photos during the
          event. Share it on a poster, slide, or chat, or open{" "}
          <span className="font-medium text-brand-black/85 dark:text-foreground">Upload</span> in the
          header for the same address.
        </p>
      </header>

      <div className="relative rounded-2xl border border-brand-black/10 bg-white p-5 shadow-[0_14px_38px_rgba(0,0,0,0.08)] sm:p-8 dark:border-white/10 dark:bg-card/80 dark:shadow-[0_14px_38px_rgba(0,0,0,0.35)]">
        <div className="mx-auto flex w-full max-w-[min(80vw,34rem)] justify-center [&_svg]:h-auto [&_svg]:max-w-full">
          <QrCodeGenerator value={uploadUrl} size={512} />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-brand-black/45 text-xs font-semibold uppercase tracking-widest dark:text-muted-foreground/80">
          Live site URL
        </p>
        <div className="flex min-h-[3.25rem] flex-col overflow-hidden rounded-2xl border border-brand-black/12 bg-brand-white shadow-[0_6px_24px_rgba(0,0,0,0.05)] sm:flex-row sm:items-stretch dark:border-white/12 dark:bg-card">
          <a
            href={uploadUrl}
            target="_blank"
            rel="noreferrer"
            className="flex min-w-0 flex-1 items-center px-4 py-3 font-mono text-sm leading-snug break-all text-brand-black underline-offset-2 hover:underline dark:text-foreground"
          >
            {uploadUrl}
          </a>
          <Button
            type="button"
            variant="ghost"
            onClick={onCopy}
            className="h-auto shrink-0 gap-2 rounded-none border-t border-brand-black/10 px-4 py-3 text-brand-black hover:bg-brand-black/[0.06] sm:border-t-0 sm:border-l dark:border-white/10 dark:text-foreground dark:hover:bg-white/8"
          >
            {copied ? <Check className="size-4 text-brand-primary" /> : <Copy className="size-4" />}
            <span className="text-sm font-medium">{copied ? "Copied" : "Copy link"}</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
