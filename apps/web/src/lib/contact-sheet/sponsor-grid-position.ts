import type { SponsorPosition } from '@blikka/image-manipulation'
import type { ContactSheetPhotoCount } from './constants'
import { getGridSize } from './constants'

export function getSponsorGridPosition(
  position: SponsorPosition,
  photoCount: ContactSheetPhotoCount,
): { row: number; col: number } {
  const isSmallGrid = photoCount === 8

  const positions = {
    'bottom-left': {
      row: isSmallGrid ? 2 : 4,
      col: 0,
    },
    'top-right': {
      row: 0,
      col: isSmallGrid ? 2 : 4,
    },
    'top-left': {
      row: 0,
      col: 0,
    },
    center: {
      row: isSmallGrid ? 1 : 2,
      col: isSmallGrid ? 1 : 2,
    },
    'bottom-right': {
      row: isSmallGrid ? 2 : 4,
      col: isSmallGrid ? 2 : 4,
    },
  } satisfies Record<SponsorPosition, { row: number; col: number }>

  return positions[position]
}

export function isSponsorCell(
  row: number,
  col: number,
  position: SponsorPosition,
  photoCount: ContactSheetPhotoCount,
  includeSponsor: boolean,
) {
  if (!includeSponsor) return false
  const sponsor = getSponsorGridPosition(position, photoCount)
  return sponsor.row === row && sponsor.col === col
}

/** Maps grid cells to photo slot index (undefined for sponsor cell). */
export function getPhotoSlotIndexForCell(
  row: number,
  col: number,
  photoCount: ContactSheetPhotoCount,
  sponsorPosition: SponsorPosition,
  includeSponsor: boolean,
): number | undefined {
  const gridSize = getGridSize(photoCount)
  let slotIndex = 0

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (isSponsorCell(r, c, sponsorPosition, photoCount, includeSponsor)) {
        if (r === row && c === col) return undefined
        continue
      }

      if (r === row && c === col) return slotIndex
      slotIndex++
    }
  }

  return undefined
}
