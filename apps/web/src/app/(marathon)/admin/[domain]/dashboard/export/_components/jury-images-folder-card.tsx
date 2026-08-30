'use client'

import { FolderDown, Images, Loader2 } from 'lucide-react'

import { PrimaryButton } from '@/components/ui/primary-button'
import { useJuryImageDownload } from '@/app/(marathon)/admin/[domain]/dashboard/jury/_lib/use-jury-image-download'
import { JuryImageDownloadDialog } from '@/app/(marathon)/admin/[domain]/dashboard/jury/_components/jury-image-download-dialog'

/**
 * Jury result images are written straight into a folder the organizer picks (File System Access API),
 * not packed into a ZIP — a whole jury runs to hundreds of large originals. This card is the export
 * page's entry point; the Jury tab has the same action.
 */
export function JuryImagesFolderCard() {
  const imageDownload = useJuryImageDownload()
  const isRunning = imageDownload.state.status !== 'idle'

  return (
    <div className="group relative rounded-xl border border-border bg-white transition-shadow duration-200 hover:border-border/80 hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.04)]">
      <div className="flex items-start gap-4 p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/80 text-muted-foreground/60">
          <Images className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight text-foreground/70">
                Jury Result Images
              </h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed mt-0.5">
                The photos behind the verdict, in one folder per juror: their shortlist with the
                winner first. Saved straight into a folder you choose.
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              FOLDER
            </span>
          </div>
        </div>
      </div>

      <div className="mx-5 mb-5 pt-4 border-t border-border/50">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground/70">
            Needs Chrome or Edge. Keep the tab open while it saves.
          </p>
          <PrimaryButton
            onClick={() => void imageDownload.start()}
            disabled={isRunning}
            className="shrink-0 h-8 px-3 text-xs"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <FolderDown className="h-3.5 w-3.5" />
                Save to folder
              </>
            )}
          </PrimaryButton>
        </div>
      </div>

      <JuryImageDownloadDialog
        state={imageDownload.state}
        onCancel={imageDownload.cancel}
        onClose={imageDownload.reset}
      />
    </div>
  )
}
