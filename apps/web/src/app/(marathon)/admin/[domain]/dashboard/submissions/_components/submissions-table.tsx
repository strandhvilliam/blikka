"use client"

import { useMemo } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from "@tanstack/react-table"
import { useRouter } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Loader2, AlertCircle, FileText } from "lucide-react"
import { formatDomainPathname } from "@/lib/utils"
import { useSubmissionsTable } from "../_hooks/use-submissions-table"
import { SubmissionsFilters } from "./submissions-filters"
import { getSubmissionsColumns } from "../_lib/submissions-columns"
import { SubmissionsBulkToolbar } from "./submissions-bulk-toolbar"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTRPC } from "@/lib/trpc/client"
import { toast } from "sonner"
import { useDomain } from "@/lib/domain-provider"
import {
  useSubmissionsTableRealtime,
  useEnrichedParticipants,
} from "../_hooks/use-submissions-table-realtime"

export function SubmissionsTable() {
  const router = useRouter()
  const trpc = useTRPC()
  const domain = useDomain()
  const queryClient = useQueryClient()
  const {
    marathon,
    sorting,
    setSorting,
    queryState,
    setQueryState,
    participants,
    isLoading,
    isError,
    isFetchingNextPage,
    hasNextPage,
    observerTarget,
    handleCompetitionClassChange,
    handleDeviceGroupChange,
    selectedIds,
    selectedCount,
    hasSelection,
    toggleSelection,
    toggleAllVisible,
    isSelected,
    clearSelection,
    canVerifySelected,
    participantsQueryPathKey,
  } = useSubmissionsTable()
  const tracking = useSubmissionsTableRealtime({
    domain,
    queryClient,
    participantsQueryPathKey,
  })
  const enrichedParticipants = useEnrichedParticipants(participants, tracking)

  const batchDeleteMutation = useMutation(
    trpc.participants.batchDelete.mutationOptions({
      onSuccess: async (data) => {
        toast.success(
          `Deleted ${data.deletedCount} participant${data.deletedCount === 1 ? "" : "s"}`,
        )
        if (data.failedIds.length > 0) {
          toast.error(
            `Failed to delete ${data.failedIds.length} participant${data.failedIds.length === 1 ? "" : "s"}`,
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
          `Verified ${data.updatedCount} participant${data.updatedCount === 1 ? "" : "s"}`,
        )
        if (data.failedIds.length > 0) {
          toast.error(
            `Failed to verify ${data.failedIds.length} participant${data.failedIds.length === 1 ? "" : "s"} (not in completed status)`,
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
          `Marked ${data.updatedCount} participant${data.updatedCount === 1 ? "" : "s"} as completed`,
        )
        if (data.failedIds.length > 0) {
          toast.error(
            `Skipped ${data.failedIds.length} participant${data.failedIds.length === 1 ? "" : "s"} already in a final status`,
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

  const selectedParticipants = participants.filter((participant) => selectedIds.has(participant.id))
  const selectedReferences = selectedParticipants.map((participant) => participant.reference)
  const completableParticipantIds = selectedParticipants
    .filter((participant) => participant.status !== "completed" && participant.status !== "verified")
    .map((participant) => participant.id)
  const selectedSubmissionIdsMissingExif = selectedParticipants
    .filter(
      (participant) =>
        participant.activeTopicSubmissionId !== null &&
        participant.submissionHealth !== null &&
        !participant.submissionHealth.hasExif,
    )
    .map((participant) => participant.activeTopicSubmissionId)
    .filter((submissionId): submissionId is number => submissionId !== null)
  const selectedSubmissionIdsMissingThumbnail = selectedParticipants
    .filter(
      (participant) =>
        participant.activeTopicSubmissionId !== null &&
        participant.submissionHealth !== null &&
        !participant.submissionHealth.hasThumbnail,
    )
    .map((participant) => participant.activeTopicSubmissionId)
    .filter((submissionId): submissionId is number => submissionId !== null)

  const handleBatchDelete = () => {
    if (selectedCount === 0) return
    batchDeleteMutation.mutate({
      ids: Array.from(selectedIds),
      domain,
    })
  }

  const handleBatchVerify = () => {
    if (selectedCount === 0 || !canVerifySelected) return
    batchVerifyMutation.mutate({
      ids: Array.from(selectedIds),
      domain,
    })
  }

  const handleBatchMarkCompleted = () => {
    if (completableParticipantIds.length === 0) return
    batchMarkCompletedMutation.mutate({
      ids: completableParticipantIds,
      domain,
    })
  }

  const handleReTriggerUploadFlow = async () => {
    if (selectedCount === 0 || !participants.length) return
    try {
      await Promise.all(
        selectedReferences.map((reference) => reTriggerMutation.mutateAsync({ domain, reference })),
      )
      toast.success(
        `Re-triggered upload flow for ${selectedReferences.length} participant${selectedReferences.length === 1 ? "" : "s"}`,
      )
      queryClient.invalidateQueries({
        queryKey: trpc.participants.getByDomainInfinite.pathKey(),
      })
      clearSelection()
    } catch (error) {
      toast.error(
        `Failed to re-trigger: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
    }
  }

  const handleBatchRerunValidations = async () => {
    if (selectedReferences.length === 0) return

    try {
      await Promise.all(
        selectedReferences.map((reference) =>
          rerunValidationsMutation.mutateAsync({ domain, reference }),
        ),
      )
      toast.success(
        `Reran validations for ${selectedReferences.length} participant${selectedReferences.length === 1 ? "" : "s"}`,
      )
      await queryClient.invalidateQueries({
        queryKey: trpc.participants.getByDomainInfinite.pathKey(),
      })
      clearSelection()
    } catch (error) {
      toast.error(
        `Failed to rerun validations: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
    }
  }

  const handleBatchRegenerateExif = async () => {
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
        `Regenerated EXIF for ${selectedSubmissionIdsMissingExif.length} submission${selectedSubmissionIdsMissingExif.length === 1 ? "" : "s"}`,
      )
      await queryClient.invalidateQueries({
        queryKey: trpc.participants.getByDomainInfinite.pathKey(),
      })
      clearSelection()
    } catch (error) {
      toast.error(
        `Failed to regenerate EXIF: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
    }
  }

  const handleBatchGenerateThumbnails = async () => {
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
        `Generated thumbnails for ${selectedSubmissionIdsMissingThumbnail.length} submission${selectedSubmissionIdsMissingThumbnail.length === 1 ? "" : "s"}`,
      )
      await queryClient.invalidateQueries({
        queryKey: trpc.participants.getByDomainInfinite.pathKey(),
      })
      clearSelection()
    } catch (error) {
      toast.error(
        `Failed to generate thumbnails: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
    }
  }

  const columns = useMemo(
    () =>
      getSubmissionsColumns({
        marathonMode: marathon?.mode,
        participants: enrichedParticipants,
        selectedIds,
        onToggleSelection: toggleSelection,
        onToggleAll: toggleAllVisible,
      }),
    [marathon?.mode, enrichedParticipants, selectedIds, toggleSelection, toggleAllVisible],
  )

  const table = useReactTable({
    data: enrichedParticipants,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    manualSorting: true,
  })

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="space-y-4 shrink-0">
        {hasSelection ? (
          <SubmissionsBulkToolbar
            marathonMode={marathon?.mode}
            selectedCount={selectedCount}
            canVerify={canVerifySelected}
            completableCount={completableParticipantIds.length}
            isDeleting={batchDeleteMutation.isPending}
            isVerifying={batchVerifyMutation.isPending}
            isMarkingCompleted={batchMarkCompletedMutation.isPending}
            isReTriggering={reTriggerMutation.isPending}
            isRerunningValidations={rerunValidationsMutation.isPending}
            isRegeneratingExif={
              regenerateAssetsMutation.isPending &&
              regenerateAssetsMutation.variables?.regenerateExif === true
            }
            isGeneratingThumbnails={
              regenerateAssetsMutation.isPending &&
              regenerateAssetsMutation.variables?.regenerateThumbnail === true
            }
            missingExifCount={selectedSubmissionIdsMissingExif.length}
            missingThumbnailCount={selectedSubmissionIdsMissingThumbnail.length}
            onClearSelection={clearSelection}
            onDelete={handleBatchDelete}
            onVerify={handleBatchVerify}
            onMarkCompleted={handleBatchMarkCompleted}
            onReTriggerUploadFlow={handleReTriggerUploadFlow}
            onRerunValidations={handleBatchRerunValidations}
            onRegenerateExif={handleBatchRegenerateExif}
            onGenerateThumbnails={handleBatchGenerateThumbnails}
          />
        ) : (
          <SubmissionsFilters
            search={queryState.search}
            onSearchChange={(search) => setQueryState({ search })}
            sortOrder={queryState.sortOrder}
            onSortOrderChange={(sortOrder) => setQueryState({ sortOrder })}
            competitionClassId={queryState.competitionClassId}
            onCompetitionClassChange={handleCompetitionClassChange}
            competitionClasses={marathon.competitionClasses}
            deviceGroupId={queryState.deviceGroupId}
            onDeviceGroupChange={handleDeviceGroupChange}
            deviceGroups={marathon.deviceGroups}
          />
        )}
      </div>

      <div className="flex-1 flex flex-col min-h-0 rounded-xl border border-border bg-white overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
          <div className="relative">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="border-b bg-muted/30 hover:bg-muted/30">
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className="h-9 font-semibold text-xs text-foreground bg-muted/50"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Loading participants...
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <AlertCircle className="h-6 w-6 text-destructive" />
                        <span className="text-sm text-destructive font-medium">
                          Error loading participants. Please try again.
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : participants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <FileText className="h-8 w-8 text-muted-foreground/50" />
                        <span className="text-sm text-muted-foreground font-medium">
                          No participants found.
                        </span>
                        {queryState.search && (
                          <span className="text-xs text-muted-foreground">
                            Try adjusting your search or filters.
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {table.getRowModel().rows.map((row) => {
                      const participant = row.original
                      const byCameraSubmissionHref =
                        participant.activeTopicSubmissionId !== null
                          ? `/admin/dashboard/submissions/${participant.reference}/${participant.activeTopicSubmissionId}`
                          : `/admin/dashboard/submissions/${participant.reference}`
                      const href = formatDomainPathname(
                        marathon?.mode === "by-camera"
                          ? byCameraSubmissionHref
                          : `/admin/dashboard/submissions/${participant.reference}`,
                        domain,
                      )
                      const isRowSelected = isSelected(participant.id)
                      return (
                        <TableRow
                          key={row.id}
                          className={`cursor-pointer transition-colors border-b ${
                            isRowSelected ? "bg-muted/80 hover:bg-muted/80" : "hover:bg-muted/60"
                          }`}
                          onClick={(e) => {
                            // Don't navigate if clicking the checkbox
                            const target = e.target as HTMLElement
                            const isCheckboxClick =
                              target.closest('[data-slot="checkbox"]') !== null
                            if (!isCheckboxClick) {
                              router.push(href)
                            }
                          }}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id} className="py-2">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                          ))}
                        </TableRow>
                      )
                    })}
                    <TableRow>
                      <TableCell colSpan={columns.length} className="py-2">
                        <div ref={observerTarget} className="flex items-center justify-center">
                          {isFetchingNextPage && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span className="text-xs">Loading more participants...</span>
                            </div>
                          )}
                          {!hasNextPage && participants.length > 0 && (
                            <div className="text-xs text-muted-foreground">
                              All {participants.length} participants loaded.
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  )
}
