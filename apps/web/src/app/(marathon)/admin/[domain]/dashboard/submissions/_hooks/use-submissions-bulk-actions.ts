'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTRPC } from '@/lib/trpc/client'
import {
  getCompletableParticipantIds,
  getSelectedParticipants,
  getSelectedReferences,
  getSubmissionIdsMissingExif,
  getSubmissionIdsMissingThumbnail,
} from '../_lib/submissions-utils'
import type { SubmissionTableRow } from '../_lib/submissions-types'

interface UseSubmissionsBulkActionsInput {
  domain: string
  participants: SubmissionTableRow[]
  selectedIds: ReadonlySet<number>
  selectedCount: number
  canVerifySelected: boolean
  clearSelection: () => void
}

export function useSubmissionsBulkActions({
  domain,
  participants,
  selectedIds,
  selectedCount,
  canVerifySelected,
  clearSelection,
}: UseSubmissionsBulkActionsInput) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const batchDeleteMutation = useMutation(
    trpc.participants.batchDelete.mutationOptions({
      onSuccess: async (data) => {
        toast.success(
          `Deleted ${data.deletedCount} participant${data.deletedCount === 1 ? '' : 's'}`,
        )
        if (data.failedIds.length > 0) {
          toast.error(
            `Failed to delete ${data.failedIds.length} participant${data.failedIds.length === 1 ? '' : 's'}`,
          )
        }

        await queryClient.invalidateQueries({
          queryKey: trpc.participants.getByDomainInfinite.pathKey(),
        })

        clearSelection()
      },
      onError: (error) => {
        toast.error(`Failed to delete participants: ${error.message}`)
      },
    }),
  )

  const batchVerifyMutation = useMutation(
    trpc.participants.batchVerify.mutationOptions({
      onSuccess: async (data) => {
        toast.success(
          `Verified ${data.updatedCount} participant${data.updatedCount === 1 ? '' : 's'}`,
        )
        if (data.failedIds.length > 0) {
          toast.error(
            `Failed to verify ${data.failedIds.length} participant${data.failedIds.length === 1 ? '' : 's'} (not in completed status)`,
          )
        }
        clearSelection()
      },
      onError: (error) => {
        toast.error(`Failed to verify participants: ${error.message}`)
      },
    }),
  )

  const batchMarkCompletedMutation = useMutation(
    trpc.participants.batchMarkCompleted.mutationOptions({
      onSuccess: async (data) => {
        toast.success(
          `Marked ${data.updatedCount} participant${data.updatedCount === 1 ? '' : 's'} as completed`,
        )
        if (data.failedIds.length > 0) {
          toast.error(
            `Skipped ${data.failedIds.length} participant${data.failedIds.length === 1 ? '' : 's'} already in a final status`,
          )
        }
        await queryClient.invalidateQueries({
          queryKey: trpc.participants.getByDomainInfinite.pathKey(),
        })
        clearSelection()
      },
      onError: (error) => {
        toast.error(`Failed to mark participants completed: ${error.message}`)
      },
    }),
  )

  const reTriggerMutation = useMutation(trpc.uploadFlow.reTriggerUploadFlow.mutationOptions())
  const rerunValidationsMutation = useMutation(trpc.validations.runValidations.mutationOptions())
  const regenerateAssetsMutation = useMutation(
    trpc.submissions.regenerateSubmissionAssets.mutationOptions(),
  )

  const selectedParticipants = getSelectedParticipants(participants, selectedIds)
  const selectedReferences = getSelectedReferences(selectedParticipants)
  const completableParticipantIds = getCompletableParticipantIds(selectedParticipants)
  const selectedSubmissionIdsMissingExif = getSubmissionIdsMissingExif(selectedParticipants)
  const selectedSubmissionIdsMissingThumbnail =
    getSubmissionIdsMissingThumbnail(selectedParticipants)

  const deleteSelected = () => {
    if (selectedCount === 0) return
    batchDeleteMutation.mutate({
      ids: Array.from(selectedIds),
      domain,
    })
  }

  const verifySelected = () => {
    if (selectedCount === 0 || !canVerifySelected) return
    batchVerifyMutation.mutate({
      ids: Array.from(selectedIds),
      domain,
    })
  }

  const markCompleted = () => {
    if (completableParticipantIds.length === 0) return
    batchMarkCompletedMutation.mutate({
      ids: completableParticipantIds,
      domain,
    })
  }

  const reTriggerUploadFlow = async () => {
    if (selectedCount === 0 || !participants.length) return
    try {
      await Promise.all(
        selectedReferences.map((reference) => reTriggerMutation.mutateAsync({ domain, reference })),
      )
      toast.success(
        `Re-triggered upload flow for ${selectedReferences.length} participant${selectedReferences.length === 1 ? '' : 's'}`,
      )
      queryClient.invalidateQueries({
        queryKey: trpc.participants.getByDomainInfinite.pathKey(),
      })
      clearSelection()
    } catch (error) {
      toast.error(
        `Failed to re-trigger: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  const rerunValidations = async () => {
    if (selectedReferences.length === 0) return

    try {
      await Promise.all(
        selectedReferences.map((reference) =>
          rerunValidationsMutation.mutateAsync({ domain, reference }),
        ),
      )
      toast.success(
        `Reran validations for ${selectedReferences.length} participant${selectedReferences.length === 1 ? '' : 's'}`,
      )
      await queryClient.invalidateQueries({
        queryKey: trpc.participants.getByDomainInfinite.pathKey(),
      })
      clearSelection()
    } catch (error) {
      toast.error(
        `Failed to rerun validations: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  const regenerateExif = async () => {
    if (selectedSubmissionIdsMissingExif.length === 0) return

    try {
      await Promise.all(
        selectedSubmissionIdsMissingExif.map((submissionId) =>
          regenerateAssetsMutation.mutateAsync({
            domain,
            submissionId,
            regenerateExif: true,
            regenerateThumbnail: false,
            rerunValidations: true,
          }),
        ),
      )
      toast.success(
        `Regenerated EXIF for ${selectedSubmissionIdsMissingExif.length} submission${selectedSubmissionIdsMissingExif.length === 1 ? '' : 's'}`,
      )
      await queryClient.invalidateQueries({
        queryKey: trpc.participants.getByDomainInfinite.pathKey(),
      })
      clearSelection()
    } catch (error) {
      toast.error(
        `Failed to regenerate EXIF: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  const generateThumbnails = async () => {
    if (selectedSubmissionIdsMissingThumbnail.length === 0) return

    try {
      await Promise.all(
        selectedSubmissionIdsMissingThumbnail.map((submissionId) =>
          regenerateAssetsMutation.mutateAsync({
            domain,
            submissionId,
            regenerateExif: false,
            regenerateThumbnail: true,
            rerunValidations: false,
          }),
        ),
      )
      toast.success(
        `Generated thumbnails for ${selectedSubmissionIdsMissingThumbnail.length} submission${selectedSubmissionIdsMissingThumbnail.length === 1 ? '' : 's'}`,
      )
      await queryClient.invalidateQueries({
        queryKey: trpc.participants.getByDomainInfinite.pathKey(),
      })
      clearSelection()
    } catch (error) {
      toast.error(
        `Failed to generate thumbnails: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  return {
    counts: {
      completableCount: completableParticipantIds.length,
      missingExifCount: selectedSubmissionIdsMissingExif.length,
      missingThumbnailCount: selectedSubmissionIdsMissingThumbnail.length,
    },
    pending: {
      isDeleting: batchDeleteMutation.isPending,
      isVerifying: batchVerifyMutation.isPending,
      isMarkingCompleted: batchMarkCompletedMutation.isPending,
      isReTriggering: reTriggerMutation.isPending,
      isRerunningValidations: rerunValidationsMutation.isPending,
      isRegeneratingExif:
        regenerateAssetsMutation.isPending &&
        regenerateAssetsMutation.variables?.regenerateExif === true,
      isGeneratingThumbnails:
        regenerateAssetsMutation.isPending &&
        regenerateAssetsMutation.variables?.regenerateThumbnail === true,
    },
    actions: {
      deleteSelected,
      verifySelected,
      markCompleted,
      reTriggerUploadFlow,
      rerunValidations,
      regenerateExif,
      generateThumbnails,
    },
  }
}
