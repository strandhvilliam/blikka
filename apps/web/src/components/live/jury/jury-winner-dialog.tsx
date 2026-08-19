'use client'

import { useRef } from 'react'
import { Trophy } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Textarea } from '@/components/ui/textarea'
import { PrimaryButton } from '@/components/ui/primary-button'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Picking a winner is the one review action a juror cannot take back with the same key, so it
 * always goes through this dialog. The motivation is the submission's own notes field — a juror who
 * already wrote why they like the photo should see that text here rather than restate it. The draft
 * lives in the viewer, which seeds it from those notes as it opens the dialog.
 */
export function JuryWinnerDialog({
  open,
  onOpenChange,
  portalContainer,
  reference,
  isWinner,
  isShortlisted,
  currentWinnerReference,
  motivation,
  onMotivationChange,
  isSaving,
  onConfirm,
  onRemove,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Fullscreen paints nothing outside its own subtree, so the dialog has to portal into it. */
  portalContainer: HTMLElement | null
  reference: string
  isWinner: boolean
  isShortlisted: boolean
  /** Reference of the winner this pick would displace, or `null` when there is no winner yet. */
  currentWinnerReference: string | null
  motivation: string
  onMotivationChange: (motivation: string) => void
  isSaving: boolean
  onConfirm: () => void
  onRemove: () => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const isReplacing = !isWinner && currentWinnerReference !== null

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        portalContainer={portalContainer}
        onOpenAutoFocus={(event) => {
          // The juror came here to write, so the caret starts in the motivation, not on a button.
          event.preventDefault()
          textareaRef.current?.focus()
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-amber-200/90 bg-amber-100 text-amber-800">
              <Trophy className="h-3.5 w-3.5" strokeWidth={2.25} />
            </span>
            {isWinner
              ? `#${reference} is your winner`
              : isReplacing
                ? 'Replace your winner?'
                : `Make #${reference} your winner?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isWinner
              ? `Edit your motivation below, or remove the win — #${reference} stays on your shortlist either way.`
              : isReplacing
                ? `#${currentWinnerReference} loses the win but stays on your shortlist.${
                    isShortlisted ? '' : ` #${reference} joins your shortlist.`
                  }`
                : `Your review can have one winner.${
                    isShortlisted ? '' : ` This also adds #${reference} to your shortlist.`
                  }`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-1.5">
          <label
            htmlFor="jury-winner-motivation"
            className="text-xs font-semibold tracking-wide text-brand-black/60 uppercase"
          >
            Motivation
          </label>
          <Textarea
            id="jury-winner-motivation"
            ref={textareaRef}
            value={motivation}
            onChange={(event) => onMotivationChange(event.target.value)}
            placeholder={`Why does #${reference} win?`}
            className="min-h-28 resize-none border-border/60 bg-neutral-50 text-sm placeholder:text-brand-gray/50 focus-visible:ring-brand-primary/20"
          />
          <p className="text-xs text-brand-gray">
            Saved as your notes for #{reference} — edits here replace what you wrote in the sidebar.
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
          {isWinner ? (
            <AlertDialogAction
              className={cn(buttonVariants({ variant: 'outline' }), 'text-destructive')}
              onClick={onRemove}
              disabled={isSaving}
            >
              Remove win
            </AlertDialogAction>
          ) : null}
          {/* The viewer closes the dialog as it saves, so this action needs no Radix wrapper. */}
          <PrimaryButton onClick={onConfirm} disabled={isSaving}>
            {isWinner ? 'Save motivation' : 'Make winner'}
          </PrimaryButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
