'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'

import { downloadFile } from '@/app/(marathon)/admin/[domain]/dashboard/export/_lib/download-file'
import { useDomain } from '@/lib/domain-provider'

/**
 * The jury results CSV. It goes through `/api/<domain>/export`, the same endpoint the export page uses,
 * so the file an organizer gets from the Jury tab cannot drift from the one on the export page. Result
 * images are handled separately by {@link useJuryImageDownload}, which writes them to a folder.
 */
export function useJuryCsvExport() {
  const domain = useDomain()
  const [pending, setPending] = useState(false)

  const exportCsv = useCallback(async () => {
    setPending(true)
    const dateStamp = new Date().toISOString().split('T')[0]

    try {
      await downloadFile(
        `/api/${domain}/export/csv_jury_results`,
        `jury-results-export-${dateStamp}.csv`,
      )
      toast.success('Jury results exported')
    } catch (error) {
      toast.error('Could not export jury results', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
      })
    } finally {
      setPending(false)
    }
  }, [domain])

  return { pending, exportCsv }
}
