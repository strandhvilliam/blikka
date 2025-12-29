"use client"
"use no memo"

import { AlertTriangle, CheckCircle, Hammer, Loader2, XCircle } from "lucide-react"
import type { ValidationResult, Topic } from "@blikka/db"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  SortingState,
  type ColumnFiltersState,
  getFilteredRowModel,
} from "@tanstack/react-table"
import { useMemo, useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useQueryClient } from "@tanstack/react-query"
import { useTRPC } from "@/lib/trpc/client"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import { useDomain } from "@/lib/domain-provider"

type ValidationResultWithOrder = ValidationResult & {
  extractedOrderIndex: number | null
  topicName: string | null
}

function extractOrderIndexFromKey(fileName: string): number | null {
  const parts = fileName.split("/")
  if (parts.length >= 3 && parts[2]) {
    return parseInt(parts[2], 10) - 1
  }

  const matches = fileName.match(/_(\d+)\./)
  if (matches && matches[1]) {
    return parseInt(matches[1], 10)
  }
  return null
}

function formatRuleKey(ruleKey: string): string {
  return ruleKey.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

const columnHelper = createColumnHelper<ValidationResultWithOrder>()

export function ValidationResultsTab({ participantRef }: { participantRef: string }) {
  const { domain } = useDomain()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [sorting, setSorting] = useState<SortingState>([{ id: "extractedOrderIndex", desc: false }])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const { data: participant } = useSuspenseQuery(
    trpc.participants.getByReference.queryOptions({
      reference: participantRef,
      domain,
    })
  )

  const { data: marathon } = useSuspenseQuery(
    trpc.marathons.getByDomain.queryOptions({
      domain,
    })
  )

  const validationResults = participant?.validationResults || []
  const topics = marathon?.topics || []

  if (!participant || !marathon) {
    return <div>Loading...</div>
  }

  const updateValidationResult = ({ id, data }: { id: number; data: { overruled: boolean } }) => {
    toast.success("Not implemented")
  }

  // const {
  //   mutate: updateValidationResult,
  //   isPending: isUpdatingValidationResult,
  // } = useMutation(
  //   trpc.validations.updateValidationResult.mutationOptions({
  //     onSuccess: () => {
  //       queryClient.invalidateQueries({
  //         queryKey: trpc.validations.pathKey(),
  //       });
  //     },
  //     onError: (error) => {
  //       console.error("Error overruling validation:", error);
  //       toast.error("Failed to overrule validation");
  //     },
  //     onSettled: () => {
  //       queryClient.invalidateQueries({
  //         queryKey: trpc.validations.pathKey(),
  //       });
  //       queryClient.invalidateQueries({
  //         queryKey: trpc.participants.pathKey(),
  //       });
  //     },
  //   }),
  // );

  const columns = useMemo(
    () => [
      columnHelper.accessor("extractedOrderIndex", {
        header: "Submission",
        cell: (info) => {
          const orderIndex = info.getValue()
          const topicName = info.row.original.topicName

          if (orderIndex !== null) {
            return (
              <div className="flex flex-col">
                <span className="font-medium">#{orderIndex + 1}</span>
                {topicName && <span className="text-sm text-muted-foreground">{topicName}</span>}
              </div>
            )
          }
          return "—"
        },
        size: 180,
        sortingFn: (a, b) => {
          const aOrder = a.original.extractedOrderIndex ?? Infinity
          const bOrder = b.original.extractedOrderIndex ?? Infinity
          return aOrder - bOrder
        },
      }),
      columnHelper.accessor("outcome", {
        header: "Status",
        cell: (info) => {
          const outcome = info.getValue()

          if (outcome === "passed") {
            return (
              <Badge className="bg-green-500/15 text-green-600 hover:bg-green-500/20">
                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                Passed
              </Badge>
            )
          } else {
            return (
              <Badge
                className={cn(
                  info.row.original.severity === "error"
                    ? "bg-destructive/15 text-destructive hover:bg-destructive/20"
                    : "bg-yellow-500/15 text-yellow-600 border-yellow-200 hover:bg-yellow-500/20"
                )}
              >
                {info.row.original.severity === "error" ? (
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                )}
                {info.row.original.severity === "error" ? "Error" : "Warning"}
              </Badge>
            )
          }
        },
        size: 120,
      }),
      columnHelper.accessor("message", {
        header: "Message",
        cell: (info) => <span className="text-xs">{info.getValue()}</span>,
        size: 400,
      }),
      columnHelper.accessor("severity", {
        header: "Severity",
        cell: (info) => (
          <span className="capitalize text-xs">
            {info.getValue() === "error" ? "Restrict" : "Warning"}
          </span>
        ),
      }),
      columnHelper.accessor("ruleKey", {
        header: "Rule",
        cell: (info) => <span className="text-xs">{formatRuleKey(info.getValue())}</span>,
      }),
      columnHelper.accessor("overruled", {
        header: "Overrule",
        cell: (info) => {
          const overruled = info.getValue()
          const outcome = info.row.original.outcome
          const validationId = info.row.original.id

          if (overruled) {
            return (
              <Badge className="bg-blue-500/15 text-blue-600 hover:bg-blue-500/20">Overruled</Badge>
            )
          } else if (outcome === "failed") {
            return (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  updateValidationResult({
                    id: validationId,
                    data: { overruled: true },
                  })
                }}
                // disabled={isUpdatingValidationResult}
                className="h-8 px-3 text-xs"
              >
                {/* {isUpdatingValidationResult ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Hammer className="h-4 w-4 mr-1" />
                )}
                {isUpdatingValidationResult ? "Overruling..." : "Overrule"} */}
              </Button>
            )
          }
          return null
        },
      }),
    ],
    [updateValidationResult]
  )

  const resultsWithOrderIndex = useMemo(
    () =>
      validationResults.map((result) => {
        let extractedOrderIndex: number | null = null
        let topicName: string | null = null

        if (result.fileName) {
          extractedOrderIndex = extractOrderIndexFromKey(result.fileName as string)
          console.log(extractedOrderIndex)

          // Find the topic name based on the order index
          if (extractedOrderIndex !== null) {
            const topic = topics.find((t) => t.orderIndex === extractedOrderIndex)
            topicName = topic?.name || null
          }
        }

        return {
          ...result,
          extractedOrderIndex,
          topicName,
        }
      }),
    [validationResults, topics]
  )

  const table = useReactTable({
    data: resultsWithOrderIndex,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: {
      sorting,
      columnFilters,
    },
    initialState: {
      sorting: [{ id: "extractedOrderIndex", desc: false }],
    },
  })

  if (validationResults.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">No validation results available</div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader className="bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ width: header.column.getSize() }}
                    className={
                      header.column.getCanSort()
                        ? "cursor-pointer select-none text-muted-foreground h-10 font-medium"
                        : ""
                    }
                    onClick={header.column.getToggleSortingHandler()}
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
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="bg-background"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className="bg-background">
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
