'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import type { SponsorPosition } from '@blikka/image-manipulation'
import type { ContactSheetFormatKey, ContactSheetPhotoCount } from '@/lib/contact-sheet/constants'
import type { ContactSheetSlot } from '@/lib/contact-sheet/sheet-slots'
import { sanitizeFilenameSegment } from '@/app/(marathon)/admin/[domain]/dashboard/export/_lib/sanitize-filename-segment'

export interface CustomContactSheetConfig {
  reference: string
  format: ContactSheetFormatKey
  sponsorPosition: SponsorPosition
  includeSponsor: boolean
  photoCount: ContactSheetPhotoCount
  topics: Array<{ name: string; orderIndex: number }>
}

interface GenerateCustomSheetInput {
  domain: string
  slots: ContactSheetSlot[]
  config: CustomContactSheetConfig
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function useGenerateCustomSheet() {
  const [isPending, startTransition] = useTransition()

  const generate = (input: GenerateCustomSheetInput) => {
    startTransition(async () => {
      const { domain, slots, config } = input

      const formData = new FormData()
      formData.append('config', JSON.stringify(config))

      for (const [orderIndex, slot] of slots.entries()) {
        if (!slot.file) continue
        formData.append(`image-${orderIndex}`, slot.file)
      }

      try {
        const response = await fetch(`/api/admin/${domain}/contact-sheet/custom`, {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          let message = 'Failed to generate contact sheet'
          try {
            const errorBody = (await response.json()) as { error?: string; details?: string }
            message = errorBody.details ?? errorBody.error ?? message
          } catch {
            // response body may not be JSON
          }
          toast.error(message)
          return
        }

        const blob = await response.blob()
        const stamp = new Date().toISOString().split('T')[0]
        const referenceSegment = sanitizeFilenameSegment(config.reference) || 'custom'
        downloadBlob(blob, `contact-sheet-${referenceSegment}-${stamp}.jpg`)
        toast.success('Contact sheet downloaded')
      } catch (error: unknown) {
        toast.error(
          error instanceof Error
            ? `Failed to generate contact sheet: ${error.message}`
            : 'Failed to generate contact sheet: Unknown error',
        )
      }
    })
  }

  return { generate, isPending }
}
