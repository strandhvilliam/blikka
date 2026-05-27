'use client'

import { useState, type DragEvent } from 'react'
import { Handshake, ImageIcon, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ContactSheetSlot } from '@/lib/contact-sheet/sheet-slots'

export const SLOT_INDEX_MIME = 'application/x-blikka-slot-index'

interface SheetGridCellBaseProps {
  topicLabel?: string
}

interface SheetGridSponsorCellProps extends SheetGridCellBaseProps {
  variant: 'sponsor'
  sponsorPreviewUrl?: string | null
}

interface SheetGridPhotoCellProps extends SheetGridCellBaseProps {
  variant: 'photo'
  slotIndex: number
  slot: ContactSheetSlot | undefined
  onCellClick: (slotIndex: number) => void
  onFilesDropped: (slotIndex: number, files: File[]) => void
  onSwap: (fromIndex: number, toIndex: number) => void
  onRemove: (slotIndex: number) => void
}

type SheetGridCellProps = SheetGridSponsorCellProps | SheetGridPhotoCellProps

export function SheetGridCell(props: SheetGridCellProps) {
  if (props.variant === 'sponsor') {
    return <SponsorCell sponsorPreviewUrl={props.sponsorPreviewUrl} />
  }
  return <PhotoCell {...props} />
}

function SponsorCell({ sponsorPreviewUrl }: { sponsorPreviewUrl?: string | null }) {
  return (
    <div className="relative flex flex-col overflow-hidden rounded-md border-2 border-dashed border-brand-primary/40 bg-brand-primary/5 transition-colors hover:bg-muted/35">
      <div className="relative min-h-0 flex-1 bg-muted/30">
        {sponsorPreviewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={sponsorPreviewUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-contain p-1"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-brand-primary/60">
            <Handshake aria-hidden="true" className="h-5 w-5" />
          </div>
        )}
      </div>
      <p className="truncate border-t border-brand-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-brand-primary">
        Sponsor
      </p>
    </div>
  )
}

function PhotoCell({
  slotIndex,
  slot,
  topicLabel,
  onCellClick,
  onFilesDropped,
  onSwap,
  onRemove,
}: SheetGridPhotoCellProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const isFilled = Boolean(slot?.file && slot.previewUrl)
  const slotNumber = slotIndex + 1
  const ariaLabelBase = topicLabel
    ? `Photo slot ${slotNumber}, topic ${topicLabel}`
    : `Photo slot ${slotNumber}`
  const ariaLabel = isFilled
    ? `${ariaLabelBase}. Filled. Click to replace.`
    : `${ariaLabelBase}. Empty. Click to upload.`

  const handleDragStart = (event: DragEvent<HTMLDivElement>) => {
    if (!isFilled) {
      event.preventDefault()
      return
    }
    event.dataTransfer.setData(SLOT_INDEX_MIME, String(slotIndex))
    event.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (!hasDraggableContent(event)) return
    event.preventDefault()
    setIsDragOver(true)
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!hasDraggableContent(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = event.dataTransfer.types.includes('Files')
      ? 'copy'
      : 'move'
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
    setIsDragOver(false)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(false)

    const files = Array.from(event.dataTransfer.files)
    if (files.length > 0) {
      onFilesDropped(slotIndex, files)
      return
    }

    const raw = event.dataTransfer.getData(SLOT_INDEX_MIME)
    if (!raw) return
    const fromIndex = Number(raw)
    if (Number.isNaN(fromIndex) || fromIndex === slotIndex) return
    onSwap(fromIndex, slotIndex)
  }

  return (
    <div
      draggable={isFilled}
      onDragStart={handleDragStart}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-md border bg-muted/20 transition-colors hover:bg-muted/40',
        isFilled ? 'border-border' : 'border-dashed border-muted-foreground/30',
        isFilled && 'cursor-grab active:cursor-grabbing',
        isDragOver && 'border-brand-primary ring-2 ring-brand-primary/40',
      )}
    >
      <button
        type="button"
        onClick={() => onCellClick(slotIndex)}
        aria-label={ariaLabel}
        className={cn(
          'relative min-h-0 flex-1 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary/50',
          isFilled && 'group-hover:bg-muted/30',
        )}
      >
        {slot?.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={slot.previewUrl}
            alt={topicLabel ? `Slot ${slotNumber} — ${topicLabel}` : `Slot ${slotNumber}`}
            className="absolute inset-0 h-full w-full object-contain p-0.5"
            draggable={false}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground/50">
            {topicLabel ? (
              <Plus aria-hidden="true" className="h-5 w-5" />
            ) : (
              <ImageIcon aria-hidden="true" className="h-4 w-4" />
            )}
          </div>
        )}
      </button>

      {isFilled ? (
        <button
          type="button"
          aria-label={`Remove photo from slot ${slotNumber}`}
          onClick={(event) => {
            event.stopPropagation()
            onRemove(slotIndex)
          }}
          className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-background/95 text-foreground shadow-sm transition-colors hover:bg-destructive hover:text-destructive-foreground focus-visible:flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 group-hover:flex"
        >
          <X aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      ) : null}

      <p className="truncate border-t border-border/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
        <span className="font-semibold text-foreground/70">{slotNumber}</span>
        {topicLabel ? (
          <span> · {topicLabel}</span>
        ) : (
          <span className="text-destructive"> · no topic</span>
        )}
      </p>
    </div>
  )
}

function hasDraggableContent(event: DragEvent<HTMLDivElement>) {
  const types = event.dataTransfer.types
  return types.includes('Files') || types.includes(SLOT_INDEX_MIME)
}
