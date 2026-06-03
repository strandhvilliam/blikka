'use client'

import { ChevronDown, ChevronUp } from 'lucide-react'

interface PhotoReorderControlsProps {
  displayIndex: number
  isFirst: boolean
  isLast: boolean
  moveUpLabel: string
  moveDownLabel: string
  onMove: (direction: 'up' | 'down') => void
}

export function PhotoReorderControls({
  displayIndex,
  isFirst,
  isLast,
  moveUpLabel,
  moveDownLabel,
  onMove,
}: PhotoReorderControlsProps) {
  return (
    <div className="flex shrink-0 flex-col">
      <button
        type="button"
        aria-label={moveUpLabel}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-25"
        disabled={isFirst}
        onClick={() => onMove('up')}
      >
        <ChevronUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label={moveDownLabel}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-25"
        disabled={isLast}
        onClick={() => onMove('down')}
      >
        <ChevronDown className="h-4 w-4" />
      </button>
      <span className="sr-only">Photo position {displayIndex + 1}</span>
    </div>
  )
}
