"use client"

import { createContext, useContext } from "react"
import type { DraggableAttributes } from "@dnd-kit/core"
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities"

export const SortableRowContext = createContext<{
  attributes: DraggableAttributes
  listeners: SyntheticListenerMap | undefined
  isDragging: boolean
} | null>(null)

export function useSortableRowContext() {
  const context = useContext(SortableRowContext)
  if (!context) {
    throw new Error("useSortableRowContext must be used within a sortable topic row or card")
  }
  return context
}
