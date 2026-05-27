'use client'

import { useState, type DragEvent } from 'react'
import type { SponsorPosition } from '@blikka/image-manipulation'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  CONTACT_SHEET_FORMATS,
  type ContactSheetFormatKey,
  type ContactSheetPhotoCount,
  getGridSize,
} from '@/lib/contact-sheet/constants'
import {
  getPhotoSlotIndexForCell,
  isSponsorCell,
} from '@/lib/contact-sheet/sponsor-grid-position'
import type { ContactSheetSlot } from '@/lib/contact-sheet/sheet-slots'
import { SheetGridCell } from './sheet-grid-cell'

interface SheetGridEditorProps {
  slots: ContactSheetSlot[]
  topicLabels: string[]
  photoCount: ContactSheetPhotoCount
  format: ContactSheetFormatKey
  sponsorPosition: SponsorPosition
  includeSponsor: boolean
  sponsorPreviewUrl?: string | null
  onCellClick: (slotIndex: number) => void
  onFilesDropped: (startSlotIndex: number, files: File[]) => void
  onSwap: (fromIndex: number, toIndex: number) => void
  onRemove: (slotIndex: number) => void
}

export function SheetGridEditor({
  slots,
  topicLabels,
  photoCount,
  format,
  sponsorPosition,
  includeSponsor,
  sponsorPreviewUrl,
  onCellClick,
  onFilesDropped,
  onSwap,
  onRemove,
}: SheetGridEditorProps) {
  const [isDragOverGrid, setIsDragOverGrid] = useState(false)
  const gridSize = getGridSize(photoCount)
  const formatConfig = CONTACT_SHEET_FORMATS[format]
  const aspectRatio = formatConfig.width / formatConfig.height

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    setIsDragOverGrid(true)
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
    setIsDragOverGrid(false)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    setIsDragOverGrid(false)
    const files = Array.from(event.dataTransfer.files)
    if (files.length === 0) return
    event.preventDefault()
    const firstEmpty = slots.findIndex((slot) => !slot.file)
    onFilesDropped(firstEmpty === -1 ? 0 : firstEmpty, files)
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'relative mx-auto w-full rounded-xl border bg-white p-3 shadow-xs transition-colors sm:p-4',
        isDragOverGrid ? 'border-brand-primary' : 'border-border',
      )}
      style={{ aspectRatio }}
    >
      <div
        className="grid h-full w-full gap-1.5"
        style={{
          gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${gridSize}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: gridSize * gridSize }).map((_, cellIndex) => {
          const row = Math.floor(cellIndex / gridSize)
          const col = cellIndex % gridSize
          const sponsor = isSponsorCell(row, col, sponsorPosition, photoCount, includeSponsor)

          if (sponsor) {
            return (
              <SheetGridCell
                key={`${row}-${col}`}
                variant="sponsor"
                sponsorPreviewUrl={sponsorPreviewUrl}
              />
            )
          }

          const slotIndex = getPhotoSlotIndexForCell(
            row,
            col,
            photoCount,
            sponsorPosition,
            includeSponsor,
          )

          if (slotIndex === undefined) return null

          return (
            <SheetGridCell
              key={`${row}-${col}`}
              variant="photo"
              slotIndex={slotIndex}
              slot={slots[slotIndex]}
              topicLabel={topicLabels[slotIndex]}
              onCellClick={onCellClick}
              onFilesDropped={onFilesDropped}
              onSwap={onSwap}
              onRemove={onRemove}
            />
          )
        })}
      </div>

      {isDragOverGrid ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl border-2 border-dashed border-brand-primary bg-brand-primary/5"
        >
          <p className="inline-flex items-center gap-2 rounded-full bg-background px-3 py-1.5 text-sm font-medium text-brand-primary shadow-sm">
            <Upload aria-hidden="true" className="h-4 w-4" />
            Drop to fill empty slots
          </p>
        </div>
      ) : null}
    </div>
  )
}
