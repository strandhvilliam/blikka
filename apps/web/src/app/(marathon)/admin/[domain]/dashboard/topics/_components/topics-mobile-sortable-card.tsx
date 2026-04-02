"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { Topic } from "@blikka/db"
import { Download, MoreVertical, Pencil, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { VISIBILITY_LABELS } from "../_lib/formatting"
import { SortableRowContext } from "./topics-sortable-context"
import { TopicsDragHandle } from "./topics-drag-handle"

type TopicsMobileSortableCardProps = {
  topic: Topic
  onEdit: (topic: Topic) => void
  onDeleteClick: (topic: Topic) => void
  isLoading: boolean
}

export function TopicsMobileSortableCard({
  topic,
  onEdit,
  onDeleteClick,
  isLoading,
}: TopicsMobileSortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: topic.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
  }

  const visibility = topic.visibility as keyof typeof VISIBILITY_LABELS
  const label = VISIBILITY_LABELS[visibility]

  return (
    <SortableRowContext.Provider value={{ attributes, listeners, isDragging }}>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "rounded-lg border border-border bg-card p-3 shadow-sm",
          isDragging && "opacity-50",
        )}
      >
        <div className="flex gap-2 sm:gap-3">
          <TopicsDragHandle id={topic.id} orderIndex={topic.orderIndex} />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="font-medium leading-snug text-foreground">{topic.name}</div>
            <Badge
              variant={label === "Public" || label === "Active" ? "default" : "secondary"}
              className="text-[10px]"
            >
              {label}
            </Badge>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-end gap-2 border-t border-border/60 pt-3">
          <Button
            size="icon"
            variant="outline"
            onClick={() => onEdit(topic)}
            disabled={isLoading}
            className="h-9 w-9 shrink-0"
            aria-label={`Edit ${topic.name}`}
          >
            <Pencil className="size-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" disabled={isLoading} className="h-9 w-9 shrink-0">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">More actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled
                onClick={() => {
                  console.log("Download zip for topic:", topic.id)
                }}
              >
                <Download className="h-4 w-4" />
                Download Zip file
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDeleteClick(topic)}
                disabled={isLoading}
              >
                <Trash2 className="h-4 w-4" />
                Delete topic
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </SortableRowContext.Provider>
  )
}
