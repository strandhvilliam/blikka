'use client'

import { flexRender, type Row } from '@tanstack/react-table'
import { useRouter } from 'next/navigation'
import { TableCell, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { getSubmissionRowHref } from '../_lib/submissions-utils'
import type { RealtimeEnrichedSubmissionTableRow } from '../_lib/submissions-types'

interface SubmissionsTableRowProps {
  row: Row<RealtimeEnrichedSubmissionTableRow>
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
  marathonMode,
  domain,
  isSelected,
}: SubmissionsTableRowProps) {
  const router = useRouter()
  const participant = row.original
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
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  )
}
