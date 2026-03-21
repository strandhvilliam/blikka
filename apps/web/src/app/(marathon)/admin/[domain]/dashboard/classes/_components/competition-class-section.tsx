"use client"

import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import { truncate } from "@/lib/utils"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { toast } from "sonner"
import { parseAsBoolean, parseAsInteger, useQueryState } from "nuqs"
import type { CompetitionClass, Topic } from "@blikka/db"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Plus, Trash2, Info } from "lucide-react"
import { useState } from "react"
import { CompetitionClassCreateDialog } from "./competition-class-create-dialog"
import { CompetitionClassEditDialog } from "./competition-class-edit-dialog"
import { CompetitionClassDeleteDialog } from "./competition-class-delete-dialog"
import { cn } from "@/lib/utils"

export function CompetitionClassSection() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const domain = useDomain()
  const [editCompetitionClassId, setEditCompetitionClassId] = useQueryState(
    "editCompetitionClassId",
    parseAsInteger,
  )
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useQueryState(
    "createCompetitionClass",
    parseAsBoolean,
  )

  const { data: marathon } = useSuspenseQuery(
    trpc.marathons.getByDomain.queryOptions({ domain }),
  )

  const classes = marathon?.competitionClasses || []
  const topics = marathon?.topics || []
  const isByCameraMode = marathon?.mode === "by-camera"

  const { mutate: deleteCompetitionClass, isPending: isDeleting } = useMutation(
    trpc.competitionClasses.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Competition class deleted successfully")
      },
      onError: (error) => {
        toast.error(error.message || "Something went wrong")
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.marathons.pathKey(),
        })
      },
    }),
  )

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedClass, setSelectedClass] = useState<CompetitionClass | null>(null)

  const handleDeleteClick = (classItem: CompetitionClass) => {
    setSelectedClass(classItem)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = (classItem: CompetitionClass) => {
    deleteCompetitionClass({ domain, id: classItem.id })
    setDeleteDialogOpen(false)
    setSelectedClass(null)
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-primary" />
          <p className="text-xs font-semibold uppercase tracking-widest text-foreground">
            Competition Classes
          </p>
        </div>
        {isByCameraMode && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            <Info className="h-3 w-3" />
            Not applicable for by-camera mode
          </span>
        )}
      </div>
      <div className={cn(isByCameraMode && "opacity-50 pointer-events-none blur-[2px]")}>
        <p className="text-[13px] text-muted-foreground leading-relaxed mb-5 max-w-lg">
          Each class determines how many photos participants need to take and what topics they start
          from. Organize different groups or categories for your event.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {classes.map((classItem) => (
            <CompetitionClassCard
              key={classItem.id}
              classItem={classItem}
              onDelete={() => handleDeleteClick(classItem)}
              onOpenEdit={() => setEditCompetitionClassId(classItem.id)}
              isDeleting={isDeleting}
              topic={topics.find(
                (topic) => topic.orderIndex === classItem.topicStartIndex,
              )}
            />
          ))}
          <button
            type="button"
            onClick={() => setIsCreateDialogOpen(true)}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/60 py-8 text-muted-foreground/60 transition-colors hover:border-border hover:bg-muted/30 hover:text-muted-foreground cursor-pointer"
          >
            <Plus className="h-5 w-5" strokeWidth={1.5} />
            <span className="text-[13px] font-medium">Add Class</span>
          </button>
          <CompetitionClassCreateDialog
            isOpen={!!isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
          />
          <CompetitionClassEditDialog
            competitionClassId={editCompetitionClassId}
            isOpen={!!editCompetitionClassId}
            onOpenChange={() => setEditCompetitionClassId(null)}
          />
          <CompetitionClassDeleteDialog
            classItem={selectedClass}
            isOpen={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            onConfirm={handleDeleteConfirm}
          />
        </div>
      </div>
    </section>
  )
}

function CompetitionClassCard({
  classItem,
  onDelete,
  isDeleting,
  onOpenEdit,
  topic,
}: {
  classItem: CompetitionClass
  onDelete: () => void
  isDeleting: boolean
  onOpenEdit: () => void
  topic?: Topic
}) {
  return (
    <div className="group relative flex flex-col justify-between rounded-xl border border-border bg-white transition-shadow duration-200 hover:border-border/80 hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.04)]">
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/80 text-muted-foreground/60">
            <span className="text-lg font-medium font-mono">{classItem.numberOfPhotos}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[11px] text-muted-foreground/70">
              {classItem.numberOfPhotos} photos
            </span>
            <span className="text-[11px] text-muted-foreground/70">
              {topic ? `Start: #${topic.orderIndex + 1}` : "—"}
            </span>
          </div>
        </div>
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight">{classItem.name}</h3>
          {classItem.description && (
            <p className="text-[13px] text-muted-foreground leading-relaxed mt-0.5">
              {classItem.description}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center px-4 pb-4 gap-1.5">
        <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={onOpenEdit}>
          Edit
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={onDelete}
          disabled={isDeleting}
          aria-label="Delete competition class"
          className="h-8 w-8"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}
