'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useSuspenseQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Grid3x3,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import type { SponsorPosition } from '@blikka/image-manipulation'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDomain } from '@/lib/domain-provider'
import { useTRPC } from '@/lib/trpc/client'
import { buildS3Url, cn, formatDomainPathname } from '@/lib/utils'
import { resolveContactSheetsSponsor } from '@/lib/sponsors/contact-sheets-sponsor'
import {
  ACCEPTED_IMAGE_TYPES,
  CONTACT_SHEET_FORMATS,
  CONTACT_SHEET_PHOTO_COUNTS,
  MAX_IMAGE_FILE_BYTES,
  SPONSOR_POSITIONS,
  type ContactSheetFormatKey,
  type ContactSheetPhotoCount,
} from '@/lib/contact-sheet/constants'
import {
  createEmptySlots,
  getTopicsForPhotoCount,
  resizeSlots,
  revokeSlotPreviewUrls,
  type ContactSheetSlot,
} from '@/lib/contact-sheet/sheet-slots'
import { SheetGridEditor } from './sheet-grid-editor'
import { useGenerateCustomSheet } from '@/hooks/use-generate-custom-sheet'

function validateFile(file: File) {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    toast.error(`"${file.name}" is not a supported image (JPEG, PNG, or WebP)`)
    return false
  }

  if (file.size > MAX_IMAGE_FILE_BYTES) {
    toast.error(`"${file.name}" is larger than 25 MB`)
    return false
  }

  return true
}

export function ContactSheetEditor() {
  const trpc = useTRPC()
  const domain = useDomain()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bulkInputRef = useRef<HTMLInputElement>(null)
  const targetSlotRef = useRef<number | null>(null)

  const { data: marathon } = useSuspenseQuery(trpc.marathons.getByDomain.queryOptions({ domain }))
  const { data: sponsors } = useSuspenseQuery(
    trpc.sponsors.getByMarathon.queryOptions({ domain }),
  )

  const contactSheetsSponsor = resolveContactSheetsSponsor(sponsors)

  const [photoCount, setPhotoCount] = useState<ContactSheetPhotoCount>(8)
  const [pendingPhotoCount, setPendingPhotoCount] = useState<ContactSheetPhotoCount | null>(null)
  const [format, setFormat] = useState<ContactSheetFormatKey>('classic')
  const [reference, setReference] = useState('')
  const [sponsorPosition, setSponsorPosition] = useState<SponsorPosition>('bottom-right')
  const [includeSponsor, setIncludeSponsor] = useState(Boolean(contactSheetsSponsor))
  const [slots, setSlots] = useState<ContactSheetSlot[]>(() => createEmptySlots(8))
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [hasAttemptedGenerate, setHasAttemptedGenerate] = useState(false)

  const { generate, isPending } = useGenerateCustomSheet()

  const topicsForSheet = getTopicsForPhotoCount(marathon.topics, photoCount)
  const topicLabels = topicsForSheet.map((topic) => topic.name)

  const sponsorPreviewUrl =
    buildS3Url(
      process.env.NEXT_PUBLIC_MARATHON_SETTINGS_BUCKET_NAME,
      contactSheetsSponsor?.key,
    ) ?? null

  const filledCount = slots.filter((slot) => slot.file).length
  const missingPhotoCount = photoCount - filledCount
  const missingTopicCount = topicLabels.filter((label) => !label.trim()).length
  const referenceMissing = reference.trim().length === 0
  const sponsorMissing = includeSponsor && !contactSheetsSponsor

  const validationMessages = [
    referenceMissing ? 'Reference is required' : null,
    missingPhotoCount > 0
      ? `${missingPhotoCount} photo${missingPhotoCount === 1 ? '' : 's'} missing`
      : null,
    missingTopicCount > 0
      ? `${missingTopicCount} topic${missingTopicCount === 1 ? '' : 's'} missing — configure them in Topics`
      : null,
    sponsorMissing ? 'Upload a contact-sheets sponsor or disable the sponsor slot' : null,
  ].filter((message): message is string => Boolean(message))

  const canGenerate = validationMessages.length === 0 && !isPending

  const applyPhotoCount = (nextCount: ContactSheetPhotoCount) => {
    setPhotoCount(nextCount)
    setSlots((current) => resizeSlots(current, nextCount))
  }

  const handlePhotoCountChange = (value: string) => {
    if (value !== '8' && value !== '24') return
    const nextCount = Number(value) as ContactSheetPhotoCount
    if (nextCount === photoCount) return

    if (nextCount < photoCount) {
      const hasFilesInRemovedSlots = slots.slice(nextCount).some((slot) => slot.file)
      if (hasFilesInRemovedSlots) {
        setPendingPhotoCount(nextCount)
        return
      }
    }

    applyPhotoCount(nextCount)
  }

  const confirmPhotoCountChange = () => {
    if (pendingPhotoCount !== null) {
      applyPhotoCount(pendingPhotoCount)
      setPendingPhotoCount(null)
    }
  }

  const handleRemove = (slotIndex: number) => {
    setSlots((current) =>
      current.map((slot, index) => {
        if (index !== slotIndex) return slot
        if (slot.previewUrl) URL.revokeObjectURL(slot.previewUrl)
        return { ...slot, file: null, previewUrl: null }
      }),
    )
  }

  const handleSwap = (fromIndex: number, toIndex: number) => {
    setSlots((current) => {
      const next = [...current]
      const from = next[fromIndex]
      const to = next[toIndex]
      if (!from || !to) return current

      next[fromIndex] = { ...from, file: to.file, previewUrl: to.previewUrl }
      next[toIndex] = { ...to, file: from.file, previewUrl: from.previewUrl }
      return next
    })
  }

  const placeFiles = (startSlotIndex: number, files: File[]) => {
    const validFiles = files.filter(validateFile)
    if (!validFiles.length) return

    setSlots((current) => {
      const next = [...current]
      let fileCursor = 0

      const writeFile = (slotIndex: number, file: File) => {
        const slot = next[slotIndex]
        if (!slot) return
        if (slot.previewUrl) URL.revokeObjectURL(slot.previewUrl)
        next[slotIndex] = {
          ...slot,
          file,
          previewUrl: URL.createObjectURL(file),
        }
      }

      const firstFile = validFiles[fileCursor]
      if (firstFile && next[startSlotIndex]) {
        writeFile(startSlotIndex, firstFile)
        fileCursor++
      }

      for (let i = 0; i < next.length && fileCursor < validFiles.length; i++) {
        if (i === startSlotIndex) continue
        if (next[i]?.file) continue
        const file = validFiles[fileCursor]
        if (!file) break
        writeFile(i, file)
        fileCursor++
      }

      const skipped = validFiles.length - fileCursor
      if (skipped > 0) {
        toast.message(
          `${skipped} file${skipped === 1 ? '' : 's'} skipped — all remaining slots are filled`,
        )
      }

      return next
    })
  }

  const handleCellClick = (slotIndex: number) => {
    targetSlotRef.current = slotIndex
    fileInputRef.current?.click()
  }

  const handleClearAll = () => {
    setSlots((current) => {
      revokeSlotPreviewUrls(current)
      return createEmptySlots(photoCount)
    })
    setShowClearConfirm(false)
  }

  const handleGenerate = () => {
    setHasAttemptedGenerate(true)
    if (!canGenerate) return

    generate({
      domain,
      slots,
      config: {
        reference: reference.trim(),
        format,
        sponsorPosition,
        includeSponsor,
        photoCount,
        topics: topicsForSheet,
      },
    })
  }

  const showValidation = hasAttemptedGenerate && validationMessages.length > 0
  const isComplete = validationMessages.length === 0
  const sponsorsHref = formatDomainPathname('/admin/dashboard/sponsors', domain)

  return (
    <div>
      <div className="mb-8">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary/10">
            <Grid3x3 aria-hidden="true" className="h-[18px] w-[18px] text-brand-primary" strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              Print
            </p>
            <h1 className="font-gothic text-2xl font-bold leading-none tracking-tight">
              Contact Sheet
            </h1>
          </div>
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Click a cell to upload, drag photos in from your desktop, or drag cells to swap. Topic
          labels come from your marathon topics and stay fixed per slot. The sponsor image is
          managed in{' '}
          <Link
            href={sponsorsHref}
            className="font-medium text-brand-primary underline-offset-2 hover:underline"
          >
            Sponsors
          </Link>
          .
        </p>
      </div>

      <div className="hidden md:block">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <SheetGridEditor
              slots={slots}
              topicLabels={topicLabels}
              photoCount={photoCount}
              format={format}
              sponsorPosition={sponsorPosition}
              includeSponsor={includeSponsor}
              sponsorPreviewUrl={sponsorPreviewUrl}
              onCellClick={handleCellClick}
              onFilesDropped={placeFiles}
              onSwap={handleSwap}
              onRemove={handleRemove}
            />

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => bulkInputRef.current?.click()}
              >
                <Upload aria-hidden="true" className="mr-2 h-4 w-4" />
                Bulk upload
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowClearConfirm(true)}
                disabled={filledCount === 0}
              >
                <Trash2 aria-hidden="true" className="mr-2 h-4 w-4" />
                Clear all
              </Button>
              <p
                className="ml-auto text-xs text-muted-foreground"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                Tip: drop a folder of photos anywhere on the grid to fill empty slots in order.
              </p>
            </div>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <div className="space-y-5 rounded-xl border border-border bg-white p-4">
              <div className="space-y-2">
                <Label htmlFor="reference">Reference</Label>
                <Input
                  id="reference"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  placeholder="DEMO-001"
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={hasAttemptedGenerate && referenceMissing}
                />
              </div>

              <div className="space-y-2">
                <Label>Photos per sheet</Label>
                <ToggleGroup
                  type="single"
                  value={String(photoCount)}
                  onValueChange={handlePhotoCountChange}
                  variant="outline"
                  className="w-full"
                >
                  {CONTACT_SHEET_PHOTO_COUNTS.map((count) => (
                    <ToggleGroupItem
                      key={count}
                      value={String(count)}
                      className="flex-1"
                      aria-label={`${count} photos, ${count === 8 ? '3 by 3' : '5 by 5'} grid`}
                    >
                      {count}
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({count === 8 ? '3×3' : '5×5'})
                      </span>
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="format-select">Format</Label>
                <Select
                  value={format}
                  onValueChange={(value) => setFormat(value as ContactSheetFormatKey)}
                >
                  <SelectTrigger id="format-select" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CONTACT_SHEET_FORMATS).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label} ({config.width} × {config.height})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sponsor-position-select">Sponsor position</Label>
                <Select
                  value={sponsorPosition}
                  onValueChange={(value) => setSponsorPosition(value as SponsorPosition)}
                >
                  <SelectTrigger
                    id="sponsor-position-select"
                    className="w-full"
                    disabled={!includeSponsor}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SPONSOR_POSITIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
                <div className="min-w-0">
                  <Label htmlFor="include-sponsor-switch" className="text-sm font-medium">
                    Include sponsor
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {contactSheetsSponsor ? (
                      'Uses the contact-sheets sponsor from Sponsors'
                    ) : (
                      <>
                        No sponsor uploaded yet —{' '}
                        <Link
                          href={sponsorsHref}
                          className="font-medium text-brand-primary underline-offset-2 hover:underline"
                        >
                          add one
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                <Switch
                  id="include-sponsor-switch"
                  checked={includeSponsor}
                  onCheckedChange={setIncludeSponsor}
                  disabled={!contactSheetsSponsor}
                />
              </div>
            </div>

            <div
              className={cn(
                'rounded-xl border p-4 transition-colors',
                showValidation
                  ? 'border-destructive/30 bg-destructive/5'
                  : isComplete
                    ? 'border-emerald-200 bg-emerald-50/50'
                    : 'border-border bg-white',
              )}
              aria-live="polite"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {isComplete ? (
                    <CheckCircle2
                      aria-hidden="true"
                      className="h-4 w-4 text-emerald-600"
                    />
                  ) : showValidation ? (
                    <AlertCircle aria-hidden="true" className="h-4 w-4 text-destructive" />
                  ) : null}
                  <p className="text-sm font-medium">
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {filledCount} of {photoCount}
                    </span>{' '}
                    placed
                  </p>
                </div>
                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      isComplete ? 'bg-emerald-500' : 'bg-brand-primary',
                    )}
                    style={{ width: `${(filledCount / photoCount) * 100}%` }}
                  />
                </div>
              </div>

              {validationMessages.length > 0 ? (
                <ul
                  className={cn(
                    'mt-3 list-disc space-y-1 pl-5 text-xs',
                    showValidation ? 'text-destructive' : 'text-muted-foreground',
                  )}
                >
                  {validationMessages.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              ) : null}

              <Button
                type="button"
                className="mt-4 w-full"
                disabled={isPending}
                onClick={handleGenerate}
              >
                {isPending ? (
                  <>
                    <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Download aria-hidden="true" className="mr-2 h-4 w-4" />
                    Generate &amp; download
                  </>
                )}
              </Button>
            </div>
          </aside>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          const slotIndex = targetSlotRef.current
          if (file && slotIndex !== null) {
            placeFiles(slotIndex, [file])
          }
          targetSlotRef.current = null
          event.target.value = ''
        }}
      />

      <input
        ref={bulkInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = event.target.files
          if (files && files.length > 0) {
            const firstEmpty = slots.findIndex((slot) => !slot.file)
            placeFiles(firstEmpty === -1 ? 0 : firstEmpty, Array.from(files))
          }
          event.target.value = ''
        }}
      />

      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center md:hidden">
        <p className="text-sm text-muted-foreground">
          The contact sheet builder needs a wider screen. Open this page on a desktop or tablet in
          landscape to arrange photos and generate a sheet.
        </p>
      </div>

      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all photos?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes all {filledCount} uploaded photo{filledCount === 1 ? '' : 's'} from this
              sheet. Topic labels and settings stay in place.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAll}>Clear all</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingPhotoCount !== null}
        onOpenChange={(open) => {
          if (!open) setPendingPhotoCount(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch to {pendingPhotoCount} photos?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingPhotoCount !== null
                ? `Photos in slots ${pendingPhotoCount + 1}–${photoCount} will be removed. This cannot be undone.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep current</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPhotoCountChange}>
              Switch &amp; remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
