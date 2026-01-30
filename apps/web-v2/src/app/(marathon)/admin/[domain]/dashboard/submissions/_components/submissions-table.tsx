"use client";

import { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
} from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, AlertCircle, FileText } from "lucide-react";
import { formatDomainPathname } from "@/lib/utils";
import { useSubmissionsTable } from "../_lib/use-submissions-table";
import { SubmissionsFilters } from "./submissions-filters";
import { getSubmissionsColumns } from "../_lib/submissions-columns";

export function SubmissionsTable() {
  const router = useRouter();
  const {
    domain,
    marathon,
    sorting,
    setSorting,
    queryState,
    setQueryState,
    participants,
    competitionClasses,
    deviceGroups,
    isLoading,
    isError,
    isFetchingNextPage,
    hasNextPage,
    observerTarget,
    handleCompetitionClassChange,
    handleDeviceGroupChange,
  } = useSubmissionsTable();

  const columns = useMemo(
    () => getSubmissionsColumns(marathon?.mode),
    [marathon?.mode],
  );

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
  });

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="space-y-4 shrink-0">
        <SubmissionsFilters
          search={queryState.search}
          onSearchChange={(search) => setQueryState({ search })}
          sortOrder={queryState.sortOrder}
          onSortOrderChange={(sortOrder) => setQueryState({ sortOrder })}
          competitionClassId={queryState.competitionClassId}
          onCompetitionClassChange={handleCompetitionClassChange}
          competitionClasses={competitionClasses}
          deviceGroupId={queryState.deviceGroupId}
          onDeviceGroupChange={handleDeviceGroupChange}
          deviceGroups={deviceGroups}
        />
      </div>

      <div className="flex-1 flex flex-col min-h-0 rounded-lg border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
          <div className="relative">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className="border-b bg-muted/30 hover:bg-muted/30"
                  >
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className="h-9 font-semibold text-xs text-foreground bg-muted/50"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-32 text-center"
                    >
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
                    <TableCell
                      colSpan={columns.length}
                      className="h-32 text-center"
                    >
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
                    <TableCell
                      colSpan={columns.length}
                      className="h-32 text-center"
                    >
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
                      const participant = row.original;
                      const href = formatDomainPathname(
                        marathon?.mode === "by-camera"
                          ? `/admin/dashboard/submissions/${participant.reference}/0`
                          : `/admin/dashboard/submissions/${participant.reference}`,
                        domain,
                      );
                      return (
                        <TableRow
                          key={row.id}
                          className="cursor-pointer transition-colors hover:bg-muted/60 border-b"
                          onClick={() => router.push(href)}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id} className="py-2">
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext(),
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })}
                    <TableRow>
                      <TableCell colSpan={columns.length} className="py-2">
                        <div
                          ref={observerTarget}
                          className="flex items-center justify-center"
                        >
                          {isFetchingNextPage && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span className="text-xs">
                                Loading more participants...
                              </span>
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
  );
}
