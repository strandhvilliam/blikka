"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function LeaderboardTabSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardContent className="p-3 sm:p-4 md:p-5">
          <div className="space-y-4">
            {/* Top 3 cards skeleton */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  className="relative overflow-hidden rounded-2xl border border-border/70 bg-white p-4"
                >
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-12 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1">
                      <Skeleton className="h-4 w-24 mb-2" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="h-4 w-4" />
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-border/60 bg-white/80 p-2">
                    <div>
                      <Skeleton className="h-2 w-12 mb-1" />
                      <Skeleton className="h-4 w-8" />
                    </div>
                    <div>
                      <Skeleton className="h-2 w-12 mb-1" />
                      <Skeleton className="h-4 w-8" />
                    </div>
                    <div>
                      <Skeleton className="h-2 w-12 mb-1" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>

                  <div className="mt-3 overflow-hidden rounded-lg border bg-muted/50">
                    <Skeleton className="aspect-[16/9] w-full" />
                  </div>
                </div>
              ))}
            </div>

            {/* Table skeleton */}
            <div className="overflow-hidden rounded-2xl border border-border/80 bg-white">
              <Table className="min-w-[760px]">
                <TableHeader className="bg-muted/40">
                  <TableRow className="border-b border-border/70 bg-muted/40 hover:bg-muted/40">
                    <TableHead className="h-10 px-4 text-xs font-semibold">
                      Rank
                    </TableHead>
                    <TableHead className="h-10 px-4 text-xs font-semibold">
                      Participant
                    </TableHead>
                    <TableHead className="h-10 px-4 text-xs font-semibold">
                      Reference
                    </TableHead>
                    <TableHead className="h-10 px-4 text-xs font-semibold">
                      Uploaded
                    </TableHead>
                    <TableHead className="h-10 px-4 text-xs font-semibold">
                      Votes
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, index) => (
                    <TableRow
                      key={index}
                      className="border-b border-border/70 hover:bg-muted/30"
                    >
                      <TableCell className="px-4 py-3">
                        <Skeleton className="h-4 w-8" />
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-4 w-8" />
                          <Skeleton className="h-1.5 w-24 rounded-full" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination skeleton */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Skeleton className="h-4 w-40" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-20" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
