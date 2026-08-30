'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'

import { downloadFile } from '@/app/(marathon)/admin/[domain]/dashboard/export/_lib/download-file'
import { useDomain } from '@/lib/domain-provider'

export type JuryExportKind = 'csv' | 'images' | 'images-preview'

interface JuryExportOptions {
  /** Restricts an image archive to one juror. The folder names stay those of the full export. */
  invitationId?: number
}

/**
 * Both jury exports go through `/api/<domain>/export`, the same endpoints the export page uses, so
 * the file an organizer gets from the Jury tab cannot drift from the one on the export page.
 */
export function useJuryExport() {
  const domain = useDomain()
  const [pendingExport, setPendingExport] = useState<JuryExportKind | null>(null)

  const runExport = useCallback(
    async (kind: JuryExportKind, options: JuryExportOptions = {}) => {
      setPendingExport(kind)

      const dateStamp = new Date().toISOString().split('T')[0]
      const params = new URLSearchParams()

      if (kind === 'images-preview') {
        params.set('format', 'preview')
      }
      if (options.invitationId !== undefined) {
        params.set('invitation', String(options.invitationId))
      }

      const query = params.toString()
      const path = kind === 'csv' ? 'csv_jury_results' : 'zip_jury_result_images'
      const filenameBase = kind === 'csv' ? 'jury-results' : 'jury-result-images'
      const extension = kind === 'csv' ? 'csv' : 'zip'

      try {
        await downloadFile(
          `/api/${domain}/export/${path}${query ? `?${query}` : ''}`,
          `${filenameBase}-export-${dateStamp}.${extension}`,
        )
        toast.success(kind === 'csv' ? 'Jury results exported' : 'Jury images exported')
      } catch (error) {
        toast.error(kind === 'csv' ? 'Could not export jury results' : 'Could not export images', {
          description: error instanceof Error ? error.message : 'An unexpected error occurred.',
        })
      } finally {
        setPendingExport(null)
      }
    },
    [domain],
  )

  return { pendingExport, runExport }
}
