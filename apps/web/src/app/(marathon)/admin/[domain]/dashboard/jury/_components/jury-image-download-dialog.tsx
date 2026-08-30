'use client'

import { CheckCircle2, FolderDown, Loader2, XCircle } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { PrimaryButton } from '@/components/ui/primary-button'
import type { JuryImageDownloadState } from '../_lib/use-jury-image-download'

interface JuryImageDownloadDialogProps {
  state: JuryImageDownloadState
  onCancel: () => void
  onClose: () => void
}

function basename(path: string): string {
  const segments = path.split('/').filter(Boolean)
  return segments[segments.length - 1] ?? path
}

export function JuryImageDownloadDialog({ state, onCancel, onClose }: JuryImageDownloadDialogProps) {
  const open = state.status !== 'idle'
  const isRunning = state.status === 'preparing' || state.status === 'writing'

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) return
        if (isRunning) onCancel()
        else onClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        {state.status === 'preparing' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Preparing download
              </DialogTitle>
              <DialogDescription>Reading the jury results…</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </DialogFooter>
          </>
        )}

        {state.status === 'writing' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FolderDown className="h-4 w-4" />
                Saving result images
              </DialogTitle>
              <DialogDescription>
                Saving images for {state.label} to the folder you chose. Keep this tab open.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Progress
                value={state.total > 0 ? (state.completed / state.total) * 100 : 0}
                className="h-2"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {state.completed} of {state.total} files
                </span>
                <span className="truncate pl-3 text-right">{basename(state.currentPath)}</span>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </DialogFooter>
          </>
        )}

        {state.status === 'done' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Download complete
              </DialogTitle>
              <DialogDescription>
                Saved {state.written} {state.written === 1 ? 'file' : 'files'} to a folder named{' '}
                <span className="font-medium text-foreground">{state.rootFolder}</span>.
              </DialogDescription>
            </DialogHeader>

            {state.failed.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <p className="font-medium">
                  {state.failed.length} {state.failed.length === 1 ? 'file' : 'files'} could not be
                  saved
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {state.failed.slice(0, 5).map((failure) => (
                    <li key={failure.path} className="truncate">
                      {basename(failure.path)} — {failure.reason}
                    </li>
                  ))}
                  {state.failed.length > 5 && <li>…and {state.failed.length - 5} more</li>}
                </ul>
              </div>
            )}

            <DialogFooter>
              <PrimaryButton onClick={onClose}>Done</PrimaryButton>
            </DialogFooter>
          </>
        )}

        {state.status === 'error' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-destructive" />
                Download failed
              </DialogTitle>
              <DialogDescription>{state.message}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
