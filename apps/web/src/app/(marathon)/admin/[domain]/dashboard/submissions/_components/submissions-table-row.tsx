'use client'

import { flexRender, type Row } from '@tanstack/react-table'
import { useRouter } from 'next/navigation'
import { TableCell, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { getSubmissionRowHref } from '../_lib/submissions-utils'
import type { RealtimeEnrichedSubmissionTableRow } from '../_lib/submissions-types'
import { SubmissionStatusBadge, UploadProgressBadge } from './submissions-column-cells'

interface SubmissionsTableRowProps {
  row: Row<RealtimeEnrichedSubmissionTableRow>
  participant: RealtimeEnrichedSubmissionTableRow
  marathonMode?: string
  domain: string
  isSelected: boolean
}

function shouldIgnoreRowNavigation(target: EventTarget): boolean {
  return (
    target instanceof HTMLElement &&
    target.closest('button,a,input,textarea,select,[role="checkbox"],[data-slot="checkbox"]') !==
      null
  )
}

export function SubmissionsTableRow({
  row,
  participant,
  marathonMode,
  domain,
  isSelected,
}: SubmissionsTableRowProps) {
  'use no memo'

  const router = useRouter()
  const href = getSubmissionRowHref({
    participant,
    marathonMode,
    domain,
  })

  return (
    <TableRow
      key={row.id}
      className={`cursor-pointer transition-colors border-b ${
        isSelected ? 'bg-muted/80 hover:bg-muted/80' : 'hover:bg-muted/60'
      }`}
      onClick={(e) => {
        if (!shouldIgnoreRowNavigation(e.target)) {
          router.push(href)
        }
      }}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell
          key={cell.id}
          className={cn(
            'py-2',
            cell.column.id === 'openIndicator' && 'w-10 px-2 align-middle',
          )}
        >
          {cell.column.id === 'status' ? (
            <SubmissionStatusBadge participant={participant} status={participant.status} />
          ) : cell.column.id === 'uploadProgress' ? (
            <UploadProgressBadge participant={participant} marathonMode={marathonMode} />
          ) : (
            flexRender(cell.column.columnDef.cell, cell.getContext())
          )}
        </TableCell>
      ))}
    </TableRow>
  )
}
