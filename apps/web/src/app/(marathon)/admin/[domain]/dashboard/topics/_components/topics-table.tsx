"use client"

import { useMemo, useState, useEffect, useCallback } from "react"
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Pencil, Trash2, MoreVertical, Download } from "lucide-react"
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import type { Topic } from "@blikka/db"
import { TopicsEditDialog } from "./topics-edit-dialog"
import { TopicsDeleteDialog } from "./topics-delete-dialog"
import {
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  UniqueIdentifier,
  DndContext,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
  SortableContext,
} from "@dnd-kit/sortable"
import { cn } from "@/lib/utils"
import { TopicsDragHandle } from "./topics-drag-handle"
import { TopicsSortableRow } from "./topics-sortable-row"
import { TopicsMarathonEmptyState } from "./topics-marathon-empty-state"
import { TopicsMobileSortableCard } from "./topics-mobile-sortable-card"
import { useIsMobile } from "@/hooks/use-mobile"

type TopicsTableProps = {
  onCreateTopic: () => void
}

export function TopicsTable({ onCreateTopic }: TopicsTableProps) {
  const domain = useDomain()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const isMobile = useIsMobile()

  const { data: marathon } = useSuspenseQuery(
    trpc.marathons.getByDomain.queryOptions({
      domain,
    })
  )

  const initialTopics = useMemo(() => {
    if (!marathon?.topics) return []
    return [...marathon.topics].sort((a, b) => a.orderIndex - b.orderIndex)
  }, [marathon?.topics])

  const [topics, setTopics] = useState<Topic[]>(() => initialTopics)

  useEffect(() => {
    setTopics(initialTopics)
  }, [initialTopics])

  const { mutate: updateTopic, isPending: isUpdatingTopic } = useMutation(
    trpc.topics.update.mutationOptions({
      onError: (error) => {
        toast.error("Failed to update topic", {
          description: error.message,
        })
        setTopics(initialTopics)
      },
      onSuccess: () => {
        toast.success("Topic updated")
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.marathons.pathKey(),
        })
      },
    })
  )

  const { mutate: deleteTopic, isPending: isDeletingTopic } = useMutation(
    trpc.topics.delete.mutationOptions({
      onError: (error) => {
        toast.error("Failed to delete topic", {
          description: error.message,
        })
        setTopics(initialTopics)
      },
      onSuccess: () => {
        toast.success("Topic deleted")
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.marathons.pathKey(),
        })
      },
    })
  )

  const handleDeleteTopic = (topicId: number) => {
    setTopics((currentTopics) => currentTopics.filter((t) => t.id !== topicId))
    deleteTopic({ domain, id: topicId })
  }

  const { mutate: updateTopicsOrder, isPending: isUpdatingOrder } = useMutation(
    trpc.topics.updateOrder.mutationOptions({
      onError: (error) => {
        toast.error("Failed to update topics order", {
          description: error.message,
        })
        setTopics(initialTopics)
      },
      onSuccess: () => {
        toast.success("Topics order updated")
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.marathons.pathKey(),
        })
      },
    })
  )

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const dataIds: UniqueIdentifier[] = useMemo(() => topics.map((t) => t.id), [topics])
  const tableKey = useMemo(() => `${dataIds.join("-")}`, [dataIds])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) {
        return
      }
      const oldIndex = dataIds.indexOf(active.id)
      const newIndex = dataIds.indexOf(over.id)
      const newData = arrayMove(topics, oldIndex, newIndex)

      // Optimistically update local state
      setTopics(newData.map((topic, index) => ({ ...topic, orderIndex: index })))

      // Update order on server
      updateTopicsOrder({
        domain,
        topicIds: newData.map((t) => t.id),
      })
    },
    [dataIds, topics, updateTopicsOrder, domain]
  )

  const isLoading = isUpdatingTopic || isDeletingTopic || isUpdatingOrder
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null)

  const handleDeleteClick = (topic: Topic) => {
    setSelectedTopic(topic)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = (topic: Topic) => {
    handleDeleteTopic(topic.id)
    setDeleteDialogOpen(false)
    setSelectedTopic(null)
  }

  const handleEditClick = (topic: Topic) => {
    setSelectedTopic(topic)
    setEditDialogOpen(true)
  }

  const columns: ColumnDef<Topic>[] = useMemo(
    () => [
      {
        id: "order",
        header: "Order",
        cell: ({ row }) => {
          return <TopicsDragHandle id={row.original.id} orderIndex={row.original.orderIndex} />
        },
      },
      {
        accessorKey: "name",
        header: "Topic",
        cell: ({ row }) => {
          const topic = row.original
          return <div className="font-medium">{topic.name}</div>
        },
      },
      {
        id: "status",
        header: "Visibility",
        cell: ({ row }) => {
          const VISIBILITY_LABELS = {
            active: "Active",
            public: "Public",
            scheduled: "Scheduled",
            private: "Private",
          } as const
          const visibility = row.original.visibility as keyof typeof VISIBILITY_LABELS

          const label = VISIBILITY_LABELS[visibility]

          return (
            <Badge
              variant={
                label === "Public" || label === "Active"
                  ? "default"
                  : "secondary"
              }
            >
              {label}
            </Badge>
          )
        },
      },
      {
        id: "actions",
        header: () => null,
        cell: ({ row }) => {
          const topic = row.original
          return (
            <div className="flex items-center justify-end gap-2">
              <Button
                size="icon"
                variant="outline"
                onClick={() => handleEditClick(topic)}
                disabled={isLoading}
                className="h-8 w-8"
              >
                <Pencil className="size-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" disabled={isLoading} className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    disabled
                    onClick={() => {
                      // TODO: Implement download zip functionality
                      console.log("Download zip for topic:", topic.id)
                    }}
                  >
                    <Download className="h-4 w-4" />
                    Download Zip file
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => handleDeleteClick(topic)}
                    disabled={isLoading}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete topic
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
      },
    ],
    [isLoading]
  )

  const table = useReactTable({
    data: topics,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id.toString(),
  })

  const headerGroups = table.getHeaderGroups()
  const columnCount = table.getAllColumns().length

  const tableHeader = (
    <TableHeader className="sticky top-0 z-10 bg-card">
      {headerGroups.map((headerGroup) => (
        <TableRow className="bg-muted/50 hover:bg-muted/50" key={headerGroup.id}>
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
  )

  const sortableList = (
    <SortableContext key={tableKey} items={dataIds} strategy={verticalListSortingStrategy}>
      {isMobile
        ? topics.map((topic) => (
            <TopicsMobileSortableCard
              key={topic.id}
              topic={topic}
              onEdit={handleEditClick}
              onDeleteClick={handleDeleteClick}
              isLoading={isLoading}
            />
          ))
        : table.getRowModel().rows.map((row) => (
            <TopicsSortableRow
              key={row.original.id}
              row={row}
              index={row.original.orderIndex}
              dataIds={dataIds}
            />
          ))}
    </SortableContext>
  )

  return (
    <>
      <div
        className={cn(
          "relative flex h-full min-h-0 flex-col overflow-hidden rounded-md border bg-card shadow-sm",
          isLoading && "pointer-events-none",
        )}
      >
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto",
            isMobile ? "overflow-x-hidden p-2 sm:p-3" : "overflow-x-auto",
          )}
        >
          {topics.length === 0 ? (
            isMobile ? (
              <div className="p-4">
                <TopicsMarathonEmptyState onCreateClick={onCreateTopic} />
              </div>
            ) : (
              <Table>
                {tableHeader}
                <TableBody>
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={columnCount}
                      className="min-w-0 border-b-0 p-4 align-top whitespace-normal"
                    >
                      <TopicsMarathonEmptyState onCreateClick={onCreateTopic} />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )
          ) : (
            <DndContext
              id={tableKey}
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              modifiers={[restrictToVerticalAxis]}
            >
              {isMobile ? (
                <div className="flex flex-col gap-2 pb-1">{sortableList}</div>
              ) : (
                <Table>
                  {tableHeader}
                  <TableBody>{sortableList}</TableBody>
                </Table>
              )}
            </DndContext>
          )}
        </div>
      </div>

      <TopicsDeleteDialog
        topic={selectedTopic}
        isOpen={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
      />

      <TopicsEditDialog
        topic={selectedTopic}
        isOpen={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </>
  )
}
