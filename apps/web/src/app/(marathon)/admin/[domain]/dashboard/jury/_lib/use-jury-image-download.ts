'use client'

import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'

import { useDomain } from '@/lib/domain-provider'
import {
  isAbortError,
  supportsDirectoryPicker,
  writeJuryImagesToDirectory,
} from './write-jury-images-to-directory'

export type JuryImageDownloadState =
  | { status: 'idle' }
  | { status: 'preparing'; label: string }
  | { status: 'writing'; label: string; completed: number; total: number; currentPath: string }
  | {
      status: 'done'
      label: string
      rootFolder: string
      written: number
      failed: Array<{ path: string; reason: string }>
    }
  | { status: 'error'; label: string; message: string }

interface StartOptions {
  /** Restricts the download to one juror. Folder numbering still matches the full export. */
  invitationId?: number
  /** Restricts the download to one topic or class. */
  scopeKey?: string
  /** Human label for the dialog, e.g. a juror's name. Defaults to the whole jury. */
  label?: string
}

/**
 * Drives a "save every result image to a folder" download and exposes the state a progress dialog
 * renders. The manifest and each image come from `/api/<domain>/export`, the same endpoints the export
 * page uses, so what the organizer gets here cannot drift from there.
 */
export function useJuryImageDownload() {
  const domain = useDomain()
  const [state, setState] = useState<JuryImageDownloadState>({ status: 'idle' })
  const abortRef = useRef<AbortController | null>(null)

  const start = useCallback(
    async (options: StartOptions = {}) => {
      if (!supportsDirectoryPicker()) {
        toast.error('This browser can’t save to a folder', {
          description:
            'Use Chrome, Edge, or another Chromium browser to download the result images to a folder.',
        })
        return
      }

      const label = options.label ?? 'the whole jury'
      const params = new URLSearchParams()
      if (options.invitationId !== undefined) {
        params.set('invitation', String(options.invitationId))
      }
      if (options.scopeKey) {
        params.set('scope', options.scopeKey)
      }
      const query = params.toString()
      const manifestUrl = `/api/${domain}/export/jury_result_images_manifest${
        query ? `?${query}` : ''
      }`

      const controller = new AbortController()
      abortRef.current = controller
      setState({ status: 'preparing', label })

      try {
        const result = await writeJuryImagesToDirectory(manifestUrl, {
          signal: controller.signal,
          onProgress: (progress) =>
            setState({
              status: 'writing',
              label,
              completed: progress.completed,
              total: progress.total,
              currentPath: progress.currentPath,
            }),
        })
        setState({
          status: 'done',
          label,
          rootFolder: result.rootFolder,
          written: result.written,
          failed: result.failed,
        })
      } catch (error) {
        // The picker being dismissed, or the organizer cancelling mid-run, is not an error.
        if (isAbortError(error)) {
          setState({ status: 'idle' })
          return
        }
        setState({
          status: 'error',
          label,
          message: error instanceof Error ? error.message : 'Something went wrong.',
        })
      } finally {
        abortRef.current = null
      }
    },
    [domain],
  )

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const reset = useCallback(() => {
    abortRef.current = null
    setState({ status: 'idle' })
  }, [])

  return { state, start, cancel, reset }
}
