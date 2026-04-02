"use client"

import { useEffect, useState } from "react"
import { GripVertical } from "lucide-react"
import { useSortableRowContext } from "./topics-sortable-context"

interface DragHandleProps {
  id: number
  orderIndex: number
}

export function TopicsDragHandle({ orderIndex }: DragHandleProps) {
  const { attributes, listeners } = useSortableRowContext()
  const [localIndex, setLocalIndex] = useState(orderIndex + 1)

  useEffect(() => {
    setLocalIndex(orderIndex + 1)
  }, [orderIndex])

  return (
    <div className="flex items-center gap-2">
      <button
        className="flex items-center cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      <div className="font-medium text-center w-6">{localIndex}</div>
    </div>
  )
}

