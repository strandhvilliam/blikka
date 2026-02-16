"use client";

import { useTRPC } from "@/lib/trpc/client";
import { useDomain } from "@/lib/domain-provider";
import { truncate } from "@/lib/utils";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { parseAsBoolean, parseAsInteger, useQueryState } from "nuqs";
import type { CompetitionClass, Topic } from "@blikka/db";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, Trash2, Info } from "lucide-react";
import { useState } from "react";
import { CompetitionClassCreateDialog } from "./competition-class-create-dialog";
import { CompetitionClassEditDialog } from "./competition-class-edit-dialog";
import { CompetitionClassDeleteDialog } from "./competition-class-delete-dialog";

export function CompetitionClassSection() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const domain = useDomain();
  const [editCompetitionClassId, setEditCompetitionClassId] = useQueryState(
    "editCompetitionClassId",
    parseAsInteger,
  );
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useQueryState(
    "createCompetitionClass",
    parseAsBoolean,
  );

  const { data: marathon } = useSuspenseQuery(
    trpc.marathons.getByDomain.queryOptions({ domain }),
  );

  const classes = marathon?.competitionClasses || [];
  const topics = marathon?.topics || [];
  const isByCameraMode = marathon?.mode === "by-camera";

  const { mutate: deleteCompetitionClass, isPending: isDeleting } = useMutation(
    trpc.competitionClasses.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Competition class deleted successfully");
      },
      onError: (error) => {
        toast.error(error.message || "Something went wrong");
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.marathons.pathKey(),
        });
      },
    }),
  );

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<CompetitionClass | null>(
    null,
  );

  const handleDeleteClick = (classItem: CompetitionClass) => {
    setSelectedClass(classItem);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = (classItem: CompetitionClass) => {
    deleteCompetitionClass({ domain, id: classItem.id });
    setDeleteDialogOpen(false);
    setSelectedClass(null);
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold font-rocgrotesk">
          Competition Classes
        </h2>
        {isByCameraMode && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted px-3 py-1.5 rounded-md z-10 relative">
            <Info className="size-4" />
            <span>Not applicable for by-camera mode</span>
          </div>
        )}
      </div>
      <div
        className={`${isByCameraMode ? "opacity-50 pointer-events-none blur-[2px]" : ""}`}
      >
        <p className="text-sm text-muted-foreground pb-4">
          Here you can add, edit, or remove competition classes for the
          marathon. Each class determines how many photos participants need to
          take and what topics they will start from. Use this section to
          organize the different groups or categories for your event.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
          <Card className="flex items-center justify-center bg-muted/50">
            <Button
              variant="ghost"
              className="w-full transition duration-200 h-full flex flex-col items-center justify-center py-10 text-muted-foreground"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              <Plus className="size-5" />
              <span>Add Class</span>
            </Button>
          </Card>
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
  );
}

function CompetitionClassCard({
  classItem,
  onDelete,
  isDeleting,
  onOpenEdit,
  topic,
}: {
  classItem: CompetitionClass;
  onDelete: () => void;
  isDeleting: boolean;
  onOpenEdit: () => void;
  topic?: Topic;
}) {
  return (
    <Card key={classItem.id} className="relative justify-between flex flex-col">
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between">
          <div className="flex h-fit items-center w-fit justify-center bg-muted rounded-lg shadow-sm border p-2">
            <span className="w-6 h-6 text-center text-lg font-medium font-mono">
              {classItem.numberOfPhotos}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground ml-auto">
              No. photos {classItem.numberOfPhotos}
            </span>
            <span className="text-xs text-muted-foreground ml-auto">
              {topic ? `Starting topic: #${topic.orderIndex + 1}` : "-"}
            </span>
          </div>
        </div>
        <div className="flex flex-col justify-between">
          <h3 className="text-lg font-semibold">{classItem.name}</h3>
          <p className="text-sm text-muted-foreground">
            {classItem.description}
          </p>
        </div>
      </div>
      <div className="flex items-center px-4 pb-4 gap-1">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 text-xs"
          onClick={onOpenEdit}
        >
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
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
}
