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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Loader2 } from "lucide-react"
import { CompetitionClass, DeviceGroup, Participant } from "@blikka/db"
import { submissionSearchParams } from "../_lib/search-params"
import { useParams, useRouter } from "next/navigation"

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
  const { domain } = useParams<{ domain: string }>()
  const router = useRouter()
  const trpc = useTRPC()
  const [sorting, setSorting] = useState<SortingState>([])

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
        cell: ({ row }) => <div className="font-medium">{row.getValue("reference")}</div>,
      },
      {
        id: "name",
        header: "Name",
        cell: ({ row }) => {
          const firstname = row.original.firstname
          const lastname = row.original.lastname
          return <div>{`${firstname} ${lastname}`}</div>
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
          return (
            <div className="capitalize">
              <span
                className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                  status === "completed"
                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                    : status === "initialized"
                      ? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                      : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                }`}
              >
                {status}
              </span>
            </div>
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
          return (
            <div className="flex gap-2 text-xs">
              <span className="text-red-600 dark:text-red-400">
                Failed: {failed.errors + failed.warnings}
              </span>
              <span className="text-green-600 dark:text-green-400">
                Passed: {passed.errors + passed.warnings}
              </span>
              {skipped.errors + skipped.warnings > 0 && (
                <span className="text-gray-600 dark:text-gray-400">
                  Skipped: {skipped.errors + skipped.warnings}
                </span>
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
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex-1 w-full sm:w-auto">
          <Input
            type="text"
            placeholder="Search by reference, name, or email..."
            value={search || ""}
            onChange={(e) => setQueryState({ search: e.target.value || null })}
            className="w-full"
          />
        </div>

        <Select
          value={sortOrder}
          onValueChange={(value) => setQueryState({ sortOrder: value as "asc" | "desc" })}
        >
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue />
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
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="All Classes" />
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
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="All Groups" />
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

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
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
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading participants...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-destructive">
                  Error loading participants. Please try again.
                </TableCell>
              </TableRow>
            ) : participants.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No participants found.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => {
                const participant = row.original
                const href = `/admin/${domain}/dashboard/submissions/${participant.reference}`
                return (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(href)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
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

      <div ref={observerTarget} className="h-4 flex items-center justify-center">
        {isFetchingNextPage && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading more...</span>
          </div>
        )}
        {!hasNextPage && participants.length > 0 && (
          <div className="text-sm text-muted-foreground">No more participants to load.</div>
        )}
      </div>
    </>
  )

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight font-rocgrotesk">Submissions</h1>
        <p className="text-muted-foreground mt-2">
          View and manage photo submissions from participants
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setQueryState({ tab: value as typeof activeTab })}
      >
        <TabsList>
          <TabsTrigger value="all">All Submissions</TabsTrigger>
          <TabsTrigger value="initialized">Initialized</TabsTrigger>
          <TabsTrigger value="not-verified">Not Verified</TabsTrigger>
          <TabsTrigger value="verified">Verified</TabsTrigger>
          <TabsTrigger value="validation-errors">Validation Errors</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-6">
          {renderFiltersAndTable()}
        </TabsContent>

        <TabsContent value="initialized" className="space-y-6">
          {renderFiltersAndTable()}
        </TabsContent>

        <TabsContent value="not-verified" className="space-y-6">
          {renderFiltersAndTable()}
        </TabsContent>

        <TabsContent value="verified" className="space-y-6">
          {renderFiltersAndTable()}
        </TabsContent>

        <TabsContent value="validation-errors" className="space-y-6">
          {renderFiltersAndTable()}
        </TabsContent>
      </Tabs>
    </div>
  )
}
