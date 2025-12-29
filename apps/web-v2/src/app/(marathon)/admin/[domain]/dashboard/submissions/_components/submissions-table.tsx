"use client"

import { useMemo, useState, useEffect, useCallback, useRef } from "react"
import { useDebounce } from "use-debounce"
import { useInfiniteQuery } from "@tanstack/react-query"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table"
import {
  useQueryStates,
  parseAsStringLiteral,
  parseAsString,
  parseAsArrayOf,
  parseAsInteger,
} from "nuqs"
import { useTRPC } from "@/lib/trpc/client"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Loader2,
  Search,
  ArrowUpDown,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  FileText,
} from "lucide-react"
import { CompetitionClass, DeviceGroup, Participant } from "@blikka/db"
import { submissionSearchParams } from "../_lib/search-params"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { SubmissionsHeader } from "./submissions-header"
import { useParticipantEvents } from "../_lib/use-participant-events"
import { useDomain } from "@/lib/domain-provider"

type TableData = Participant & {
  competitionClass: CompetitionClass | null
  deviceGroup: DeviceGroup | null
  failedValidationResults: { errors: number; warnings: number }
  passedValidationResults: { errors: number; warnings: number }
  skippedValidationResults: { errors: number; warnings: number }
  zipKeys: string[]
  contactSheetKeys: string[]
}

export function SubmissionsTable() {
  const domain = useDomain()
  const router = useRouter()
  const trpc = useTRPC()
  const [sorting, setSorting] = useState<SortingState>([])
  useParticipantEvents()

  const [queryState, setQueryState] = useQueryStates(submissionSearchParams, {
    history: "push",
  })

  const { tab: activeTab, search, sortOrder, competitionClassId, deviceGroupId } = queryState
  const [debouncedSearch] = useDebounce(search || "", 300)

  const normalizedCompetitionClassId = useMemo(() => {
    if (!competitionClassId || competitionClassId.length === 0) return undefined
    return competitionClassId.length === 1 ? competitionClassId[0] : competitionClassId
  }, [competitionClassId])

  const normalizedDeviceGroupId = useMemo(() => {
    if (!deviceGroupId || deviceGroupId.length === 0) return undefined
    return deviceGroupId.length === 1 ? deviceGroupId[0] : deviceGroupId
  }, [deviceGroupId])

  const getTabQueryParams = useCallback(() => {
    switch (activeTab) {
      case "all":
        return {
          statusFilter: null,
          excludeStatuses: null,
          hasValidationErrors: null,
        }
      case "initialized":
        return {
          statusFilter: null,
          excludeStatuses: ["completed", "verified"],
          hasValidationErrors: null,
        }
      case "not-verified":
        return {
          statusFilter: "completed" as const,
          excludeStatuses: null,
          hasValidationErrors: null,
        }
      case "verified":
        return {
          statusFilter: "verified" as const,
          excludeStatuses: null,
          hasValidationErrors: null,
        }
      case "validation-errors":
        return {
          statusFilter: null,
          excludeStatuses: null,
          hasValidationErrors: true,
        }
    }
  }, [activeTab])

  const tabQueryParams = getTabQueryParams()

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } =
    useInfiniteQuery(
      trpc.participants.getByDomainInfinite.infiniteQueryOptions(
        {
          domain,
          cursor: null,
          search: debouncedSearch || null,
          sortOrder: sortOrder || null,
          competitionClassId: normalizedCompetitionClassId ?? null,
          deviceGroupId: normalizedDeviceGroupId ?? null,
          statusFilter: tabQueryParams.statusFilter,
          excludeStatuses: tabQueryParams.excludeStatuses,
          hasValidationErrors: tabQueryParams.hasValidationErrors,
          limit: 50,
        },
        {
          getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
        }
      )
    )

  const participants = useMemo(() => data?.pages.flatMap((page) => page.participants) ?? [], [data])

  const competitionClasses = useMemo(() => {
    const classes = new Map<number, { id: number; name: string }>()
    participants.forEach((p) => {
      if (p.competitionClass) {
        classes.set(p.competitionClass.id, p.competitionClass)
      }
    })
    return Array.from(classes.values())
  }, [participants])

  const deviceGroups = useMemo(() => {
    const groups = new Map<number, { id: number; name: string }>()
    participants.forEach((p) => {
      if (p.deviceGroup) {
        groups.set(p.deviceGroup.id, p.deviceGroup)
      }
    })
    return Array.from(groups.values())
  }, [participants])

  const observerTarget = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0.1 }
    )

    const currentTarget = observerTarget.current
    if (currentTarget) {
      observer.observe(currentTarget)
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget)
      }
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const columns = useMemo<ColumnDef<TableData>[]>(
    () => [
      {
        accessorKey: "reference",
        header: "Reference",
        cell: ({ row }) => (
          <div className="font-semibold text-foreground">{row.getValue("reference")}</div>
        ),
      },
      {
        id: "name",
        header: "Name",
        cell: ({ row }) => {
          const firstname = row.original.firstname
          const lastname = row.original.lastname
          return <div className="font-medium">{`${firstname} ${lastname}`}</div>
        },
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => (
          <div className="text-muted-foreground">{row.getValue("email") || "-"}</div>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Initialized At",
        cell: ({ row }) => {
          const createdAt = row.getValue("createdAt") as string
          const date = new Date(createdAt)
          return (
            <div className="text-muted-foreground">
              {date.toLocaleString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          )
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = row.getValue("status") as string
          const statusConfig = {
            completed: {
              variant: "default" as const,
              className:
                "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
              icon: CheckCircle2,
            },
            initialized: {
              variant: "outline" as const,
              className:
                "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700",
              icon: Clock,
            },
            verified: {
              variant: "default" as const,
              className:
                "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
              icon: CheckCircle2,
            },
          }
          const config =
            statusConfig[status as keyof typeof statusConfig] || statusConfig.initialized
          const Icon = config.icon
          return (
            <Badge
              variant={config.variant}
              className={cn("capitalize font-medium gap-1.5", config.className)}
            >
              <Icon className="size-3" />
              {status}
            </Badge>
          )
        },
      },
      {
        id: "competitionClass",
        header: "Competition Class",
        cell: ({ row }) => {
          const competitionClass = row.original.competitionClass
          return <div>{competitionClass?.name || "-"}</div>
        },
      },
      {
        id: "deviceGroup",
        header: "Device Group",
        cell: ({ row }) => {
          const deviceGroup = row.original.deviceGroup
          return <div>{deviceGroup?.name || "-"}</div>
        },
      },
      {
        id: "validationResults",
        header: "Validation Results",
        cell: ({ row }) => {
          const failed = row.original.failedValidationResults
          const passed = row.original.passedValidationResults
          const skipped = row.original.skippedValidationResults
          const failedCount = failed.errors + failed.warnings
          const passedCount = passed.errors + passed.warnings
          const skippedCount = skipped.errors + skipped.warnings
          return (
            <div className="flex items-center gap-2 flex-wrap">
              {failedCount > 0 && (
                <Badge variant="destructive" className="gap-1.5 text-xs font-medium">
                  <XCircle className="size-3" />
                  {failedCount}
                </Badge>
              )}
              {passedCount > 0 && (
                <Badge
                  variant="default"
                  className="gap-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                >
                  <CheckCircle2 className="size-3" />
                  {passedCount}
                </Badge>
              )}
              {skippedCount > 0 && (
                <Badge
                  variant="outline"
                  className="gap-1.5 text-xs font-medium text-muted-foreground"
                >
                  <AlertCircle className="size-3" />
                  {skippedCount}
                </Badge>
              )}
              {failedCount === 0 && passedCount === 0 && skippedCount === 0 && (
                <span className="text-xs text-muted-foreground">-</span>
              )}
            </div>
          )
        },
      },
    ],
    []
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

  const handleCompetitionClassChange = useCallback(
    (value: string) => {
      if (value === "all") {
        setQueryState({ competitionClassId: null })
      } else {
        const ids = value.split(",").map(Number)
        setQueryState({ competitionClassId: ids })
      }
    },
    [setQueryState]
  )

  const handleDeviceGroupChange = useCallback(
    (value: string) => {
      if (value === "all") {
        setQueryState({ deviceGroupId: null })
      } else {
        const ids = value.split(",").map(Number)
        setQueryState({ deviceGroupId: ids })
      }
    },
    [setQueryState]
  )

  const renderFiltersAndTable = () => (
    <>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search by reference, name, or email..."
              value={search || ""}
              onChange={(e) => setQueryState({ search: e.target.value || null })}
              className="w-full pl-9 h-10 bg-background"
            />
          </div>

          <div className="flex flex-wrap gap-3 w-full sm:w-auto">
            <Select
              value={sortOrder}
              onValueChange={(value) => setQueryState({ sortOrder: value as "asc" | "desc" })}
            >
              <SelectTrigger className="w-full sm:w-[160px] h-10 bg-background">
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="size-4 text-muted-foreground shrink-0" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Newest First</SelectItem>
                <SelectItem value="asc">Oldest First</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={
                !competitionClassId || competitionClassId.length === 0
                  ? "all"
                  : competitionClassId.join(",")
              }
              onValueChange={handleCompetitionClassChange}
            >
              <SelectTrigger className="w-full sm:w-[220px] h-10 bg-background">
                <div className="flex items-center gap-2">
                  <Filter className="size-4 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="All Classes" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Competition Classes</SelectItem>
                {competitionClasses.map((cc) => (
                  <SelectItem key={cc.id} value={cc.id.toString()}>
                    {cc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={!deviceGroupId || deviceGroupId.length === 0 ? "all" : deviceGroupId.join(",")}
              onValueChange={handleDeviceGroupChange}
            >
              <SelectTrigger className="w-full sm:w-[200px] h-10 bg-background">
                <div className="flex items-center gap-2">
                  <Filter className="size-4 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="All Groups" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Device Groups</SelectItem>
                {deviceGroups.map((dg) => (
                  <SelectItem key={dg.id} value={dg.id.toString()}>
                    {dg.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="border-b bg-muted/30 hover:bg-muted/30">
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="h-12 font-semibold text-foreground">
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
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-32 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Loading participants...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-32 text-center">
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
                  <TableCell colSpan={columns.length} className="h-32 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileText className="h-8 w-8 text-muted-foreground/50" />
                      <span className="text-sm text-muted-foreground font-medium">
                        No participants found.
                      </span>
                      {search && (
                        <span className="text-xs text-muted-foreground">
                          Try adjusting your search or filters.
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => {
                  const participant = row.original
                  const href = `/admin/dashboard/submissions/${participant.reference}`
                  return (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer transition-colors hover:bg-muted/60 border-b"
                      onClick={() => router.push(href)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="py-3">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div ref={observerTarget} className="h-8 flex items-center justify-center py-4">
        {isFetchingNextPage && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading more participants...</span>
          </div>
        )}
        {!hasNextPage && participants.length > 0 && (
          <div className="text-sm text-muted-foreground">
            All {participants.length} participants loaded.
          </div>
        )}
      </div>
    </>
  )

  const renderContent = () => {
    switch (activeTab) {
      case "all":
      case "initialized":
      case "not-verified":
      case "verified":
      case "validation-errors":
        return renderFiltersAndTable()
      default:
        return renderFiltersAndTable()
    }
  }

  return <div className="space-y-6">{renderContent()}</div>
}
