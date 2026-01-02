"use client"

import { useSortable } from "@dnd-kit/sortable"
import type { Row } from "@tanstack/react-table"
import type { Topic } from "@blikka/db"
import type { UniqueIdentifier } from "@dnd-kit/core"
import { cn } from "@/lib/utils"
import { flexRender } from "@tanstack/react-table"
import { TableCell, TableRow } from "@/components/ui/table"
import { CSS } from "@dnd-kit/utilities"
import { createContext, useContext } from "react"
import type { DraggableAttributes } from "@dnd-kit/core"
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities"

const SortableRowContext = createContext<{
  attributes: DraggableAttributes
  listeners: SyntheticListenerMap | undefined
  isDragging: boolean
} | null>(null)

export const useSortableRowContext = () => {
  const context = useContext(SortableRowContext)
  if (!context) {
    throw new Error("useSortableRowContext must be used within a TopicsSortableRow")
  }
  return context
}

interface TopicsSortableRowProps {
  row: Row<Topic>
  index: number
  dataIds: UniqueIdentifier[]
}

export function TopicsSortableRow({ row }: TopicsSortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: row.original.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
  }

  const contextValue = {
    attributes,
    listeners,
    isDragging,
  }

  return (
    <SortableRowContext.Provider value={contextValue}>
      <TableRow
        key={row.original.id}
        ref={setNodeRef}
        style={style}
        className={cn(
          "bg-background cursor-default",
          isDragging && "opacity-50"
        )}
        data-order-index={row.original.orderIndex}
      >
        {row.getVisibleCells().map((cell) => (
          <TableCell key={cell.id}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        ))}
      </TableRow>
    </SortableRowContext.Provider>
  )
}

