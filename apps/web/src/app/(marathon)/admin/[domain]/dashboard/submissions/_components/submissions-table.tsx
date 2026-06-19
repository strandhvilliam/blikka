'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useDomain } from '@/lib/domain-provider'
import { useSubmissionsQuery } from '../_hooks/use-submissions-query'
import { useSubmissionsSelection } from '../_hooks/use-submissions-selection'
import { useSubmissionsTableModel } from '../_hooks/use-submissions-table-model'
import { SubmissionsFilters } from './submissions-filters'
import { SubmissionsBulkToolbar } from './submissions-bulk-toolbar'
import {
  useEnrichedParticipants,
  useSubmissionsTableRealtime,
} from '../_hooks/use-submissions-table-realtime'
import { SubmissionsTableView } from './submissions-table-view'
import type { SubmissionsMarathon } from '../_lib/submissions-types'

interface SubmissionsTableProps {
  marathon: SubmissionsMarathon
  realtimeEnabled?: boolean
}

export function SubmissionsTable({ marathon, realtimeEnabled = true }: SubmissionsTableProps) {
  const domain = useDomain()
  const queryClient = useQueryClient()
  const query = useSubmissionsQuery({ marathon })
  const tracking = useSubmissionsTableRealtime({
    domain,
    queryClient,
    participantsQueryPathKey: query.participantsQueryPathKey,
    enabled: realtimeEnabled,
  })
  const enrichedParticipants = useEnrichedParticipants(query.participants, tracking)
  const selection = useSubmissionsSelection(query.participants)
  const { table, columns } = useSubmissionsTableModel({
    marathonMode: marathon.mode,
    verificationMode: marathon.verificationMode,
    participants: enrichedParticipants,
    selectedIds: selection.selectedIds,
    toggleSelection: selection.toggleSelection,
    toggleAllVisible: selection.toggleAllVisible,
  })

  return (
    <div className="flex flex-col h-full space-y-2 md:space-y-4">
      <div className="shrink-0 space-y-2 md:space-y-4">
        {selection.hasSelection ? (
          <SubmissionsBulkToolbar
            marathonMode={marathon.mode}
            participants={query.participants}
            selectedIds={selection.selectedIds}
            selectedCount={selection.selectedCount}
            canVerifySelected={selection.canVerifySelected}
            onClearSelection={selection.clearSelection}
          />
        ) : (
          <SubmissionsFilters
            search={query.queryState.search}
            onSearchChange={(search) => query.setQueryState({ search })}
            sortOrder={query.queryState.sortOrder}
            onSortOrderChange={(sortOrder) => query.setQueryState({ sortOrder })}
            competitionClassId={query.queryState.competitionClassId}
            onCompetitionClassChange={query.handleCompetitionClassChange}
            competitionClasses={marathon.competitionClasses}
            deviceGroupId={query.queryState.deviceGroupId}
            onDeviceGroupChange={query.handleDeviceGroupChange}
            deviceGroups={marathon.deviceGroups}
            hideSortAndCompetitionClass={marathon.mode === 'by-camera'}
          />
        )}
      </div>

      <SubmissionsTableView
        table={table}
        participants={enrichedParticipants}
        columnsCount={columns.length}
        marathonMode={marathon.mode}
        verificationMode={marathon.verificationMode}
        domain={domain}
        isLoading={query.isLoading}
        isError={query.isError}
        isFetchingNextPage={query.isFetchingNextPage}
        hasNextPage={query.hasNextPage}
        participantCount={query.participants.length}
        hasSearch={Boolean(query.queryState.search)}
        observerTarget={query.observerTarget}
        isSelected={selection.isSelected}
      />
    </div>
  )
}
