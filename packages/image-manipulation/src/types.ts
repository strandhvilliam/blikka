export interface SheetVariables {
  cellWidth: number
  cellHeight: number
  availableImageHeight: number
  imageWidth: number
  imageHeight: number
  textHeight: number
  sequenceSpace: number
  /** Bottom-margin height reserved for topic footnotes; 0 when the sheet has none. */
  footnoteSpace: number
  availableWidth: number
  availableHeight: number
}

export type SponsorPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center'
