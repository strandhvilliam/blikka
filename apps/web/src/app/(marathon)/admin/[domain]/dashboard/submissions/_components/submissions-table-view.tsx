'use client'

import { flexRender, type Table as TanstackTable } from '@tanstack/react-table'
import type { RefObject } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { RealtimeEnrichedSubmissionTableRow } from '../_lib/submissions-types'
import { SubmissionsTableRow } from './submissions-table-row'
import { SubmissionsTableStateRow } from './submissions-table-state-row'

interface SubmissionsTableViewProps {
  table: TanstackTable<RealtimeEnrichedSubmissionTableRow>
  participants: RealtimeEnrichedSubmissionTableRow[]
  columnsCount: number
  marathonMode?: string
  domain: string
  isLoading: boolean
  isError: boolean
  isFetchingNextPage: boolean
  hasNextPage?: boolean
  participantCount: number
  hasSearch: boolean
  observerTarget: RefObject<HTMLDivElement | null>
  isSelected: (id: number) => boolean
}

export function SubmissionsTableView({
  table,
  participants,
  columnsCount,
  marathonMode,
  domain,
  isLoading,
  isError,
  isFetchingNextPage,
  hasNextPage,
  participantCount,
  hasSearch,
  observerTarget,
  isSelected,
}: SubmissionsTableViewProps) {
  'use no memo'

  const rows = table.getRowModel().rows
  const participantById = new Map(participants.map((participant) => [participant.id, participant]))

  return (
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
                      className={cn(
                        'h-9 font-semibold text-xs text-foreground bg-muted/50',
                        header.column.id === 'openIndicator' && 'w-10 px-2',
                      )}
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
                <SubmissionsTableStateRow type="loading" colSpan={columnsCount} />
              ) : isError ? (
                <SubmissionsTableStateRow type="error" colSpan={columnsCount} />
              ) : participantCount === 0 ? (
                <SubmissionsTableStateRow
                  type="empty"
                  colSpan={columnsCount}
                  hasSearch={hasSearch}
                />
              ) : (
                <>
                  {rows.map((row) => {
                    const participant = participantById.get(row.original.id) ?? row.original
                    return (
                      <SubmissionsTableRow
                        key={`${row.id}-${participant.realtimeProcessedCount}-${
                          participant.realtimeIsFinalized ? 'finalized' : 'open'
                        }-${participant.status}`}
                        row={row}
                        participant={participant}
                        marathonMode={marathonMode}
                        domain={domain}
                        isSelected={isSelected(row.original.id)}
                      />
                    )
                  })}
                  <TableRow>
                    <TableCell colSpan={columnsCount} className="py-2">
                      <div ref={observerTarget} className="flex items-center justify-center">
                        {isFetchingNextPage && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-xs">Loading more participants...</span>
                          </div>
                        )}
                        {!hasNextPage && participantCount > 0 && (
                          <div className="text-xs text-muted-foreground">
                            All {participantCount} participants loaded.
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
  )
}
