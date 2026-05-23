'use client'

import { useMemo, useState } from 'react'
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table'
import { getSubmissionsColumns } from '../_lib/submissions-columns'
import type { RealtimeEnrichedSubmissionTableRow } from '../_lib/submissions-types'

interface UseSubmissionsTableModelInput {
  marathonMode?: string
  participants: RealtimeEnrichedSubmissionTableRow[]
  selectedIds: Set<number>
  toggleSelection: (id: number, event: React.MouseEvent) => void
  toggleAllVisible: () => void
}

export function useSubmissionsTableModel({
  marathonMode,
  participants,
  selectedIds,
  toggleSelection,
  toggleAllVisible,
}: UseSubmissionsTableModelInput) {
  const [sorting, setSorting] = useState<SortingState>([])
  const columns = useMemo(
    () =>
      getSubmissionsColumns({
        marathonMode,
        participants,
        selectedIds,
        onToggleSelection: toggleSelection,
        onToggleAll: toggleAllVisible,
      }),
    [marathonMode, participants, selectedIds, toggleSelection, toggleAllVisible],
  )

  const table = useReactTable({
    data: participants,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    manualSorting: true,
  })

  return {
    table,
    columns,
  }
}
