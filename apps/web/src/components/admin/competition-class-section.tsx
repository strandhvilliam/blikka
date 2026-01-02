"use client";

import { useDomain } from "@/contexts/domain-context";
import { useTRPC } from "@/trpc/client";
import { truncate } from "@/lib/utils";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { CompetitionClassCreateDialog } from "./competition-class-create-dialog";
import { CompetitionClassEditDialog } from "./competition-class-edit-dialog";
import { parseAsBoolean, parseAsInteger, useQueryState } from "nuqs";
import { CompetitionClass, Topic } from "@vimmer/api/db/types";
import { Button } from "@vimmer/ui/components/button";
import { Card } from "@vimmer/ui/components/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@vimmer/ui/components/tooltip";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@vimmer/ui/components/alert-dialog";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

export function CompetitionClassSection() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { domain } = useDomain();
  const [editCompetitionClassId, setEditCompetitionClassId] = useQueryState(
    "editCompetitionClassId",
    parseAsInteger,
  );
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useQueryState(
    "createCompetitionClass",
    parseAsBoolean,
  );

  const { data: classes } = useSuspenseQuery(
    trpc.competitionClasses.getByDomain.queryOptions({ domain }),
  );

  const { data: topics } = useSuspenseQuery(
    trpc.topics.getByDomain.queryOptions({ domain }),
  );

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
          queryKey: trpc.competitionClasses.pathKey(),
        });
      },
    }),
  );

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold font-rocgrotesk">
          Competition Classes
        </h2>
      </div>
      <p className="text-sm text-muted-foreground pb-4">
        Here you can add, edit, or remove competition classes for the marathon.
        Each class determines how many photos participants need to take and what
        topics they will start from. Use this section to organize the different
        groups or categories for your event.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {classes.map((classItem) => (
          <CompetitionClassCard
            key={classItem.id}
            classItem={classItem}
            onDelete={() => deleteCompetitionClass({ id: classItem.id })}
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
            <Plus className="h-8 w-8" />
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
  const [isAlertOpen, setIsAlertOpen] = useState(false);

  const renderAlertDialog = () => {
    return (
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setIsAlertOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => onDelete()}
              disabled={isDeleting}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  };

  return (
    <Card key={classItem.id} className="relative justify-between flex flex-col">
      <div className="flex flex-col gap-2 p-4">
        <div className="flex justify-between">
          <div className="flex h-fit items-center w-fit justify-center bg-muted rounded-lg shadow-sm border p-2">
            <span className="w-6 h-6 text-center text-lg font-medium font-mono ">
              {classItem.numberOfPhotos}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            No. photos {classItem.numberOfPhotos}
          </span>
        </div>
        <div className="flex flex-col tems-center justify-between">
          <h3 className="text-lg font-semibold">{classItem.name}</h3>
          <p className="text-sm text-muted-foreground">
            {classItem.description}
          </p>
          <div className="flex h-fit items-center w-fit justify-center bg-muted rounded-lg shadow-sm border px-2 py-1 mt-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  Starting topic:
                  <span className="font-mono text-xs text-vimmer-primary">
                    {topic
                      ? `#${topic?.orderIndex + 1} (${truncate(topic?.name, { length: 20 })})`
                      : "-"}
                  </span>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Starting topic index for this class
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
      <div className="flex items-center px-4 pb-4 gap-2">
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
          variant="ghost"
          onClick={() => setIsAlertOpen(true)}
          aria-label="Delete competition class"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
        {renderAlertDialog()}
      </div>
    </Card>
  );
}
