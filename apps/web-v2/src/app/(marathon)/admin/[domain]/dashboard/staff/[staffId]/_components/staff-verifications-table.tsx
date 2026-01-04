"use client"

import { useMemo, useState, useEffect, useRef } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table"
import { useTRPC } from "@/lib/trpc/client"
import { Input } from "@/components/ui/input"
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
  CheckCircle,
  Mail,
  Calendar,
  FileText,
  Camera,
  Shield,
  User2,
} from "lucide-react"
import { cn, formatDomainPathname } from "@/lib/utils"
import { useDomain } from "@/lib/domain-provider"
import { useRouter } from "next/navigation"
import { useDebounce } from "use-debounce"

type VerificationData = {
  id: number
  createdAt: string
  notes: string | null
  participant: {
    id: number
    reference: string
    firstname: string
    lastname: string
    email: string | null
    status: string
    competitionClass: {
      id: number
      name: string
    } | null
    deviceGroup: {
      id: number
      name: string
    } | null
    submissions: any[]
  }
}

interface StaffVerificationsTableProps {
  staffId: string
  totalCount?: number
}

export function StaffVerificationsTable({ staffId, totalCount = 0 }: StaffVerificationsTableProps) {
  const domain = useDomain()
  const router = useRouter()
  const trpc = useTRPC()
  const [sorting, setSorting] = useState<SortingState>([])
  const [search, setSearch] = useState("")
  const [debouncedSearch] = useDebounce(search, 300)

  const observerTarget = useRef<HTMLDivElement>(null)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery(
    trpc.users.getVerificationsByStaffId.infiniteQueryOptions(
      {
        staffId,
        domain,
        limit: 20,
      },
      {
        getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
      }
    )
  )

  const verifications = useMemo(() => {
    return data?.pages.flatMap((page) => page.items) ?? []
  }, [data])

  const filteredVerifications = useMemo(() => {
    if (!debouncedSearch.trim()) return verifications
    const searchLower = debouncedSearch.toLowerCase()
    return verifications.filter(
      (v) =>
        v.participant.reference.toLowerCase().includes(searchLower) ||
        v.participant.firstname.toLowerCase().includes(searchLower) ||
        v.participant.lastname.toLowerCase().includes(searchLower) ||
        (v.participant.email && v.participant.email.toLowerCase().includes(searchLower))
    )
  }, [verifications, debouncedSearch])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0.1 }
    )

    const target = observerTarget.current
    if (target) {
      observer.observe(target)
    }

    return () => {
      if (target) {
        observer.unobserve(target)
      }
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            Verified
          </Badge>
        )
      case "completed":
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-200">
            Completed
          </Badge>
        )
      case "processing":
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 border-yellow-200">
            Processing
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="bg-muted">
            {status}
          </Badge>
        )
    }
  }

  const columns = useMemo<ColumnDef<VerificationData>[]>(
    () => [
      {
        accessorKey: "participant.reference",
        header: "Reference",
        size: 120,
        cell: ({ row }) => (
          <div className="font-mono font-medium">#{row.original.participant.reference}</div>
        ),
      },
      {
        accessorKey: "participant.name",
        header: "Participant",
        size: 200,
        cell: ({ row }) => (
          <div className="space-y-1">
            <div className="font-medium">
              {row.original.participant.firstname} {row.original.participant.lastname}
            </div>
            {row.original.participant.email && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {row.original.participant.email}
              </div>
            )}
          </div>
        ),
      },
      {
        accessorKey: "participant.status",
        header: "Status",
        size: 120,
        cell: ({ row }) => getStatusBadge(row.original.participant.status),
      },
      {
        accessorKey: "participant.competitionClass",
        header: "Class",
        size: 150,
        cell: ({ row }) => {
          const competitionClass = row.original.participant.competitionClass
          return competitionClass ? (
            <div className="text-sm">{competitionClass.name}</div>
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          )
        },
      },
      {
        accessorKey: "createdAt",
        header: "Verified",
        size: 180,
        cell: ({ row }) => {
          const date = new Date(row.original.createdAt)
          return (
            <div className="text-sm flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              {date.toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}{" "}
              at{" "}
              {date.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          )
        },
      },
      {
        accessorKey: "notes",
        header: "Notes",
        size: 200,
        cell: ({ row }) => {
          const notes = row.original.notes
          return notes ? (
            <div className="text-xs text-muted-foreground line-clamp-2 flex items-start gap-1">
              <FileText className="h-3 w-3 mt-0.5 shrink-0" />
              <span>{notes}</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          )
        },
      },
    ],
    []
  )

  const table = useReactTable({
    data: filteredVerifications,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
    onSortingChange: setSorting,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (verifications.length === 0) {
    return (
      <div className="bg-background rounded-lg border border-border/40 shadow-sm p-12">
        <div className="flex flex-col items-center justify-center text-center">
          <Shield className="h-12 w-12 mb-3 text-muted-foreground/50" />
          <p className="text-sm font-medium text-muted-foreground">No verifications yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            This staff member hasn't verified any participants
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 ">
      <div className="relative flex">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by reference, name, or email..."
          className="pl-9 bg-background border-border/40"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="border border-border bg-background rounded-md overflow-hidden">
        <Table className="min-w-[970px]">
          <TableHeader className="bg-muted/50 sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-muted/50">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ width: header.column.getSize() }}
                    className="font-semibold text-foreground"
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
              <>
                {table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() =>
                      router.push(
                        formatDomainPathname(
                          `/admin/dashboard/submissions/${row.original.participant.reference}`,
                          domain
                        )
                      )
                    }
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="text-sm">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </>
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <Search className="h-8 w-8 mb-2 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">No matches found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Try adjusting your search query
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div ref={observerTarget} className="h-4" />

        {isFetchingNextPage && (
          <div className="flex items-center justify-center py-4 border-t bg-muted/30">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
            <span className="text-sm text-muted-foreground">Loading more...</span>
          </div>
        )}
      </div>
    </div>
  )
}
