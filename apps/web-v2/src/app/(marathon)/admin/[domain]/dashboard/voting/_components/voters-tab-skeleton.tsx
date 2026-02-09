"use client"

import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function VotersTabSkeleton() {
  return (
    <div className="space-y-4">
      <div>
        <Skeleton className="h-7 w-40 mb-2" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      
      {/* Voting progress skeleton */}
      <div className="rounded-lg border bg-card shadow-sm p-4">
        <Skeleton className="h-4 w-32 mb-3" />
        <Skeleton className="h-2 w-full rounded-full mb-2" />
        <div className="flex justify-between">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>

      {/* Table skeleton */}
      <div>
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow className="border-b bg-muted/30 hover:bg-muted/30">
                  <TableHead className="h-9 bg-muted/50 text-xs font-semibold text-foreground">
                    Voter
                  </TableHead>
                  <TableHead className="h-9 bg-muted/50 text-xs font-semibold text-foreground">
                    Token
                  </TableHead>
                  <TableHead className="h-9 bg-muted/50 text-xs font-semibold text-foreground">
                    Email
                  </TableHead>
                  <TableHead className="h-9 bg-muted/50 text-xs font-semibold text-foreground">
                    Phone
                  </TableHead>
                  <TableHead className="h-9 bg-muted/50 text-xs font-semibold text-foreground">
                    Vote
                  </TableHead>
                  <TableHead className="h-9 bg-muted/50 text-right text-xs font-semibold text-foreground">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, index) => (
                  <TableRow
                    key={index}
                    className="border-b transition-colors hover:bg-muted/60"
                  >
                    <TableCell className="py-2">
                      <div className="space-y-1 flex items-center gap-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-5 w-20 rounded-full" />
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell className="py-2">
                      <Skeleton className="h-4 w-40" />
                    </TableCell>
                    <TableCell className="py-2">
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell className="py-2">
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex justify-end gap-2">
                        <Skeleton className="h-7 w-24" />
                        <Skeleton className="h-7 w-20" />
                        <Skeleton className="h-7 w-7" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
        
        {/* Pagination skeleton */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-4 w-40" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
      </div>
    </div>
  )
}
