import { IconDots, IconGripVertical } from "@tabler/icons-react";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Button } from "@ui-sdk/react/button";
import { Dialog, DialogBackdrop, DialogContent, DialogTitle } from "@ui-sdk/react/dialog";
import { Field, FieldError, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@ui-sdk/react/menu";
import { createTopicMutation, deleteTopicMutation, topicsQuery, updateTopicMutation } from "@/api/topics.ts";
import { ConfirmDialog } from "@/components/ConfirmDialog.tsx";
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
  // The Api refuses to delete it (409); this only words the failure.
  const lastOfPublished = competition.published_at !== null && topics.length === 1;
  const byId = new Map(topics.map((topic) => [topic.id, topic]));
  const saved = topics.map((topic) => topic.id);
  const order = moved ?? saved;

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      {topics.length === 0 ? (
        <div className="flex flex-col items-center gap-1 py-16 text-center">
          <p className="font-medium">No topics yet</p>
          <p className="text-sm text-balance text-muted-foreground">
            Add at least one to publish the event. A single theme can be one topic, such as "Open".
          </p>
        </div>
      ) : (
        <SortableList
          aria-label="Topics"
          className="flex flex-col divide-y divide-border border-y border-border"
          value={order}
          onValueChange={(next) => {
            const change = movedItem(order, next);

            if (!change) {
              return;
            }

            setMoved(next);
            move.mutate({ id: change.key, position: change.position }, { onSettled: () => setMoved(null) });
          }}
        >
          {order.map((id, index) => {
            const topic = byId.get(id);

            // A topic deleted while a move was saving.
            if (!topic) {
              return null;
            }

            return (
              <SortableListItem key={id} value={id} className="flex items-center gap-3 bg-background py-2">
                {canWrite && (
                  <SortableListHandle value={id} aria-label={`Move ${topic.name}`}>
                    <IconGripVertical aria-hidden />
                  </SortableListHandle>
                )}
                <span className="w-6 shrink-0 text-right text-sm text-muted-foreground tabular-nums">{index + 1}</span>
                <span className="min-w-0 flex-1 font-medium wrap-anywhere">{topic.name}</span>
                {canWrite && (
                  <TopicActions topic={topic} competitionId={competition.id} lastOfPublished={lastOfPublished} />
                )}
              </SortableListItem>
            );
          })}
        </SortableList>
      )}
      {move.isError && (
        <p role="alert" className="text-sm text-destructive">
          Couldn't move the topic. Try again.
        </p>
      )}
      {canWrite && <AddTopic competitionId={competition.id} />}
    </div>
  );
}

function AddTopic({ competitionId }: { competitionId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const create = useMutation(createTopicMutation(competitionId));
  const [name, setName] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate(name.trim(), {
          // Ready for the next one, so a list of topics can be typed in one go.
          onSuccess: () => {
            setName("");
            input.current?.focus();
          },
        });
      }}
    >
      <Field invalid={create.isError ? true : undefined}>
        <FieldLabel>New topic</FieldLabel>
        <div className="flex gap-2">
          <Input
            ref={input}
            required
            maxLength={100}
            autoComplete="off"
            value={name}
            onValueChange={(value) => {
              setName(value);

              if (create.isError) {
                create.reset();
              }
            }}
          />
          <Button type="submit" data-variant="solid" disabled={create.isPending || !name.trim()}>
            Add
          </Button>
        </div>
        {create.isError && <FieldError>Couldn't add the topic. Try again.</FieldError>}
      </Field>
    </form>
  );
}

function TopicActions({
  topic,
  competitionId,
  lastOfPublished,
}: {
  topic: Topic;
  competitionId: string;
  lastOfPublished: boolean;
}) {
  const remove = useMutation(deleteTopicMutation(competitionId));
  const [action, setAction] = useState<"rename" | "delete">();
  const trigger = useRef<HTMLButtonElement>(null);

  return (
    <>
      <Menu>
        <MenuTrigger ref={trigger} aria-label={`Actions for ${topic.name}`}>
          <IconDots aria-hidden />
        </MenuTrigger>
        <MenuContent align="end">
          <MenuItem onSelect={() => setAction("rename")}>Rename</MenuItem>
          <MenuItem destructive onSelect={() => setAction("delete")}>
            Delete
          </MenuItem>
        </MenuContent>
      </Menu>
      {/* Mounted while closed too, so closing can hand focus back to the menu's trigger. */}
      <Rename
        topic={topic}
        competitionId={competitionId}
        open={action === "rename"}
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
  );
}

function Rename({
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
  const rename = useMutation(updateTopicMutation(competitionId));
  const [name, setName] = useState(topic.name);

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
          setName(topic.name);
          rename.reset();
        }
      }}
    >
      <DialogBackdrop />
      <DialogContent finalFocus={finalFocus}>
        <DialogTitle>Rename topic</DialogTitle>
        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            rename.mutate({ id: topic.id, name: name.trim() }, { onSuccess: onClose });
          }}
        >
          <Field invalid={rename.isError ? true : undefined}>
            <FieldLabel>Name</FieldLabel>
            <Input
              autoFocus
              required
              maxLength={100}
              autoComplete="off"
              value={name}
              onValueChange={(value) => {
                setName(value);

                if (rename.isError) {
                  rename.reset();
                }
              }}
            />
            {rename.isError && <FieldError>Couldn't rename the topic. Try again.</FieldError>}
          </Field>
          <Button
            type="submit"
            data-variant="solid"
            className="self-end"
            disabled={rename.isPending || !name.trim() || name.trim() === topic.name}
          >
            Save
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
