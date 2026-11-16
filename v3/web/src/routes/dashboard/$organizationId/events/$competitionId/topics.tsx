import { IconDots, IconGripVertical, IconListNumbers, IconPlus } from "@tabler/icons-react";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Button } from "@ui-sdk/react/button";
import {
  Dialog,
  DialogBackdrop,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@ui-sdk/react/dialog";
import { Field, FieldError, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@ui-sdk/react/menu";
import { createTopicMutation, deleteTopicMutation, topicsQuery, updateTopicMutation } from "@/api/topics.ts";
import { Card } from "@/components/Card.tsx";
import { ConfirmDialog } from "@/components/ConfirmDialog.tsx";
import { EmptyState } from "@/components/EmptyState.tsx";
import { PageHeader } from "@/components/PageHeader.tsx";
import { SortableList, SortableListHandle, SortableListItem } from "@/components/SortableList.tsx";
import { movedItem } from "@/components/SortableList.logic.ts";

export const Route = createFileRoute("/dashboard/$organizationId/events/$competitionId/topics")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(topicsQuery(params.competitionId)),
  component: Topics,
});

type Topic = { id: string; name: string; position: number };

function Topics() {
  const { competition, organization } = Route.useRouteContext();
  const { data: topics } = useSuspenseQuery(topicsQuery(competition.id));
  const move = useMutation(updateTopicMutation(competition.id));
  // The dropped order, shown until the Api's order comes back with it or the move fails.
  const [moved, setMoved] = useState<string[] | null>(null);
  const canWrite = organization.permissions.includes("competitions:write");
  // The Api refuses to delete it (409).
  const lastOfPublished = competition.published_at !== null && topics.length === 1;
  const byId = new Map(topics.map((topic) => [topic.id, topic]));
  const saved = topics.map((topic) => topic.id);
  const order = moved ?? saved;

  const save = (next: string[], change: { key: string; position: number }) => {
    setMoved(next);
    move.mutate({ id: change.key, position: change.position }, { onSettled: () => setMoved(null) });
  };

  return (
    // The header as wide as the list, so New topic sits over it.
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader
        title={
          <>
            Topics
            {topics.length > 0 && (
              <span className="ms-2 align-[0.125rem] font-mono text-sm font-normal text-muted-foreground">
                {topics.length}
              </span>
            )}
          </>
        }
        description="What participants photograph, in this order. Names stay hidden until the event opens."
      >
        {canWrite && <NewTopic competitionId={competition.id} />}
      </PageHeader>
      <Card className="overflow-hidden">
        {topics.length === 0 && (
          <EmptyState
            icon={IconListNumbers}
            title="No topics yet"
            description={'Add at least one to publish the event. A single theme can be one topic, such as "Open".'}
          />
        )}
        {topics.length > 0 && (
          <SortableList
            aria-label="Topics"
            className="flex flex-col divide-y divide-border"
            value={order}
            onValueChange={(next) => {
              const change = movedItem(order, next);

              if (change) {
                save(next, change);
              }
            }}
          >
            {/* In the order the drag shows, so the numbers follow it too. */}
            {(state) =>
              state.order.map((id, index) => {
                const topic = byId.get(id);

                // A topic deleted while a move was saving.
                if (!topic) {
                  return null;
                }

                return (
                  <TopicRow
                    key={id}
                    topic={topic}
                    index={index}
                    competitionId={competition.id}
                    canWrite={canWrite}
                    lastOfPublished={lastOfPublished}
                  />
                );
              })
            }
          </SortableList>
        )}
        {move.isError && (
          <p role="alert" className="border-t border-border px-5 py-3 text-sm text-destructive">
            Couldn't move the topic. Try again.
          </p>
        )}
      </Card>
    </div>
  );
}

function NewTopic({ competitionId }: { competitionId: string }) {
  const create = useMutation(createTopicMutation(competitionId));
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);

        if (!next) {
          setName("");
          create.reset();
        }
      }}
    >
      <DialogTrigger data-variant="solid" className="rounded-full ps-3 pe-3.5">
        <IconPlus aria-hidden />
        New topic
      </DialogTrigger>
      <DialogBackdrop />
      <DialogContent>
        <DialogTitle>New topic</DialogTitle>
        <DialogDescription>It goes last. Drag it to change its place.</DialogDescription>
        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(name.trim(), {
              onSuccess: () => {
                setOpen(false);
                setName("");
              },
            });
          }}
        >
          <Field invalid={create.isError ? true : undefined}>
            <FieldLabel>Name</FieldLabel>
            <Input
              autoFocus
              autoComplete="off"
              placeholder="Something red"
              required
              maxLength={100}
              value={name}
              onValueChange={(value) => {
                setName(value);

                if (create.isError) {
                  create.reset();
                }
              }}
            />
            {create.isError && <FieldError>Couldn't add the topic. Try again.</FieldError>}
          </Field>
          <Button type="submit" data-variant="solid" className="self-end" disabled={create.isPending || !name.trim()}>
            Add topic
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TopicRow({
  topic,
  index,
  competitionId,
  canWrite,
  lastOfPublished,
}: {
  topic: Topic;
  index: number;
  competitionId: string;
  canWrite: boolean;
  lastOfPublished: boolean;
}) {
  const remove = useMutation(deleteTopicMutation(competitionId));
  const [action, setAction] = useState<"edit" | "delete">();
  const trigger = useRef<HTMLButtonElement>(null);

  return (
    <SortableListItem
      value={topic.id}
      className="flex min-h-12 items-center gap-2 bg-card px-3 py-2 hover:bg-muted/40 data-grabbed:bg-muted data-dragging:not-data-settling:bg-muted/50"
    >
      {canWrite && (
        <SortableListHandle value={topic.id} aria-label={`Move ${topic.name}`}>
          <IconGripVertical aria-hidden />
        </SortableListHandle>
      )}
      {/* A frame number, like the roll's 04/08. */}
      <span data-position className="w-5 shrink-0 text-end font-mono text-xs text-muted-foreground">
        {String(index + 1).padStart(2, "0")}
      </span>
      <span className="min-w-0 flex-1 px-2.5 font-medium wrap-anywhere">{topic.name}</span>
      {canWrite && (
        <>
          <Menu>
            <MenuTrigger
              ref={trigger}
              aria-label={`Actions for ${topic.name}`}
              className="size-8 shrink-0 border-transparent bg-transparent p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <IconDots aria-hidden />
            </MenuTrigger>
            <MenuContent align="end">
              <MenuItem onSelect={() => setAction("edit")}>Edit</MenuItem>
              <MenuSeparator />
              <MenuItem destructive disabled={lastOfPublished} label="Delete" onSelect={() => setAction("delete")}>
                {lastOfPublished ? (
                  <span className="flex flex-col py-1">
                    Delete
                    <span className="text-xs text-muted-foreground">A published event needs a topic</span>
                  </span>
                ) : (
                  "Delete"
                )}
              </MenuItem>
            </MenuContent>
          </Menu>
          {/* Mounted while closed too, so closing can hand focus back to the menu's trigger. */}
          <EditTopic
            topic={topic}
            competitionId={competitionId}
            open={action === "edit"}
            onClose={() => setAction(undefined)}
            finalFocus={() => trigger.current}
          />
          <ConfirmDialog
            open={action === "delete"}
            onOpenChange={(open) => !open && setAction(undefined)}
            title={`Delete ${topic.name}?`}
            description="The topics after it move up one place."
            action="Delete"
            onConfirm={() => remove.mutateAsync(topic.id)}
            finalFocus={() => trigger.current}
            failure={
              lastOfPublished
                ? "A published event needs at least one topic. Add another first, or unpublish the event."
                : "Couldn't delete the topic. Try again."
            }
          />
        </>
      )}
    </SortableListItem>
  );
}

// Only the name for now; a topic's other settings join it here.
function EditTopic({
  topic,
  competitionId,
  open,
  onClose,
  finalFocus,
}: {
  topic: Topic;
  competitionId: string;
  open: boolean;
  onClose: () => void;
  finalFocus: () => HTMLElement | null;
}) {
  const update = useMutation(updateTopicMutation(competitionId));
  const [name, setName] = useState(topic.name);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
          setName(topic.name);
          update.reset();
        }
      }}
    >
      <DialogBackdrop />
      <DialogContent finalFocus={finalFocus}>
        <DialogTitle>Edit topic</DialogTitle>
        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            // The list refetches before this resolves, so the old name never flashes back.
            update.mutate({ id: topic.id, name: name.trim() }, { onSuccess: onClose });
          }}
        >
          <Field invalid={update.isError ? true : undefined}>
            <FieldLabel>Name</FieldLabel>
            <Input
              autoFocus
              autoComplete="off"
              required
              maxLength={100}
              value={name}
              onValueChange={(value) => {
                setName(value);

                if (update.isError) {
                  update.reset();
                }
              }}
            />
            {update.isError && <FieldError>Couldn't save the topic. Try again.</FieldError>}
          </Field>
          <Button
            type="submit"
            data-variant="solid"
            className="self-end"
            disabled={update.isPending || !name.trim() || name.trim() === topic.name}
          >
            Save
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
