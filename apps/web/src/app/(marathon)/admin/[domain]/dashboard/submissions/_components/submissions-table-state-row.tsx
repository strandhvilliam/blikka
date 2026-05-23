'use client'

import { AlertCircle, FileText, Loader2 } from 'lucide-react'
import { TableCell, TableRow } from '@/components/ui/table'

interface SubmissionsTableStateRowProps {
  type: 'loading' | 'error' | 'empty'
  colSpan: number
  hasSearch?: boolean
}

export function SubmissionsTableStateRow({
  type,
  colSpan,
  hasSearch,
}: SubmissionsTableStateRowProps) {
  if (type === 'loading') {
    return (
      <TableRow>
        <TableCell colSpan={colSpan} className="h-32 text-center">
          <div className="flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading participants...</span>
          </div>
        </TableCell>
      </TableRow>
    )
  }

  if (type === 'error') {
    return (
      <TableRow>
        <TableCell colSpan={colSpan} className="h-32 text-center">
          <div className="flex flex-col items-center justify-center gap-2">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <span className="text-sm text-destructive font-medium">
              Error loading participants. Please try again.
            </span>
          </div>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="h-32 text-center">
        <div className="flex flex-col items-center justify-center gap-2">
          <FileText className="h-8 w-8 text-muted-foreground/50" />
          <span className="text-sm text-muted-foreground font-medium">No participants found.</span>
          {hasSearch && (
            <span className="text-xs text-muted-foreground">
              Try adjusting your search or filters.
            </span>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}
