'use client'

import { FileCode, FileImage, Loader2, MoreHorizontal, RefreshCw, ReplaceIcon } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Submission } from '@blikka/db'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTRPC } from '@/lib/trpc/client'
import { useDomain } from '@/lib/domain-provider'
import { hasExifData } from '../_lib/submission-helpers'

interface SubmissionPreviewActionsMenuProps {
  submission: Submission
  participantRef: string
  marathonMode?: string
  onReplace: () => void
}

export function SubmissionPreviewActionsMenu({
  submission,
  participantRef,
  marathonMode,
  onReplace,
}: SubmissionPreviewActionsMenuProps) {
  const domain = useDomain()
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const hasExif = hasExifData(submission.exif)
  const hasThumbnail = Boolean(submission.thumbnailKey)
  const isByCameraMode = marathonMode === 'by-camera'
  const showThumbnailFix = isByCameraMode && !hasThumbnail
  const showExifFix = isByCameraMode && !hasExif

  async function invalidateParticipant() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: trpc.participants.getByReference.queryKey({
          reference: participantRef,
          domain,
        }),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.participants.getByDomainInfinite.pathKey(),
      }),
      queryClient.invalidateQueries({ queryKey: trpc.validations.pathKey() }),
    ])
  }

  const rerunValidations = useMutation(
    trpc.validations.runValidations.mutationOptions({
      onSuccess: async (data) => {
        toast.success(`Validations rerun (${data.resultsCount} results)`)
        await invalidateParticipant()
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to rerun validations')
      },
    }),
  )

  const regenerateAssets = useMutation(
    trpc.submissions.regenerateSubmissionAssets.mutationOptions({
      onSuccess: async (data, variables) => {
        const action = getRegenerateAssetMessage(variables)
        toast.success(
          variables.rerunValidations
            ? `${action}. Validations reran with ${data.validationResultsCount} results.`
            : action,
        )
        await invalidateParticipant()
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to refresh submission assets')
      },
    }),
  )

  const busy = rerunValidations.isPending || regenerateAssets.isPending

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Submission actions"
          disabled={busy}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MoreHorizontal className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
          Submission
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={onReplace} className="gap-2">
          <ReplaceIcon className="h-4 w-4" />
          Replace photo…
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => rerunValidations.mutate({ domain, reference: participantRef })}
          className="gap-2"
          disabled={busy}
        >
          <RefreshCw className={cn('h-4 w-4', rerunValidations.isPending && 'animate-spin')} />
          Rerun validations
        </DropdownMenuItem>
        {showExifFix || showThumbnailFix ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
              Recovery
            </DropdownMenuLabel>
            {showExifFix ? (
              <DropdownMenuItem
                onSelect={() =>
                  regenerateAssets.mutate({
                    domain,
                    submissionId: submission.id,
                    regenerateExif: true,
                    regenerateThumbnail: false,
                    rerunValidations: true,
                  })
                }
                className="gap-2"
                disabled={busy}
              >
                <FileCode className="h-4 w-4" />
                Regenerate EXIF + revalidate
              </DropdownMenuItem>
            ) : null}
            {showThumbnailFix ? (
              <DropdownMenuItem
                onSelect={() =>
                  regenerateAssets.mutate({
                    domain,
                    submissionId: submission.id,
                    regenerateExif: false,
                    regenerateThumbnail: true,
                    rerunValidations: false,
                  })
                }
                className="gap-2"
                disabled={busy}
              >
                <FileImage className="h-4 w-4" />
                Generate thumbnail
              </DropdownMenuItem>
            ) : null}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function getRegenerateAssetMessage(variables: {
  regenerateExif: boolean
  regenerateThumbnail: boolean
}): string {
  if (variables.regenerateExif && variables.regenerateThumbnail) {
    return 'Submission assets refreshed'
  }
  if (variables.regenerateExif) return 'EXIF regenerated'
  if (variables.regenerateThumbnail) return 'Thumbnail generated'
  return 'Submission updated'
}
