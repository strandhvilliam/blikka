import { IconArrowDown, IconArrowUp, IconDots } from "@tabler/icons-react";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useId, useRef, useState } from "react";
import { createTopicMutation, deleteTopicMutation, topicsQuery, updateTopicMutation } from "@/api/topics.ts";
import { ConfirmDialog } from "@/components/ConfirmDialog.tsx";
import { Button } from "@/components/ui/Button.tsx";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu.tsx";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/Empty.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { Item, ItemActions, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/Item.tsx";
import { Label } from "@/components/ui/Label.tsx";

export const Route = createFileRoute("/dashboard/$organizationId/events/$competitionId/topics")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(topicsQuery(params.competitionId)),
  component: Topics,
});

type Topic = { id: string; name: string; position: number };

function Topics() {
  const { competition, organization } = Route.useRouteContext();
  const { data: topics } = useSuspenseQuery(topicsQuery(competition.id));
  const move = useMutation(updateTopicMutation(competition.id));
  const canWrite = organization.permissions.includes("competitions:write");
  // The Api refuses to delete it (409); this only words the failure.
  const lastOfPublished = competition.published_at !== null && topics.length === 1;

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      {topics.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No topics yet</EmptyTitle>
            <EmptyDescription>Add at least one to publish the event. A single theme can be one topic, such as "Open".</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ItemGroup>
          {topics.map((topic) => (
            <Item key={topic.id} variant="outline">
              <span className="w-6 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{topic.position}</span>
              <ItemContent className="min-w-0">
                <ItemTitle className="wrap-anywhere">{topic.name}</ItemTitle>
              </ItemContent>
              {canWrite && (
                <ItemActions>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move ${topic.name} up`}
                    disabled={move.isPending || topic.position === 1}
                    onClick={() => move.mutate({ id: topic.id, position: topic.position - 1 })}
                  >
                    <IconArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move ${topic.name} down`}
                    disabled={move.isPending || topic.position === topics.length}
                    onClick={() => move.mutate({ id: topic.id, position: topic.position + 1 })}
                  >
                    <IconArrowDown />
                  </Button>
                  <TopicActions topic={topic} competitionId={competition.id} lastOfPublished={lastOfPublished} />
                </ItemActions>
              )}
            </Item>
          ))}
        </ItemGroup>
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
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const create = useMutation(createTopicMutation(competitionId));
  const [name, setName] = useState("");

  return (
    <form
      className="grid gap-2"
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
      <Label htmlFor={id}>New topic</Label>
      <div className="flex gap-2">
        <Input
          ref={input}
          id={id}
          required
          maxLength={100}
          autoComplete="off"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (create.isError) create.reset();
          }}
        />
        <Button type="submit" disabled={create.isPending || !name.trim()}>
          Add
        </Button>
      </div>
      {create.isError && (
        <p role="alert" className="text-sm text-destructive">
          Couldn't add the topic. Try again.
        </p>
      )}
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

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${topic.name}`} />}>
          <IconDots />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setAction("rename")}>Rename</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => setAction("delete")}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {action === "rename" && (
        <Rename topic={topic} competitionId={competitionId} onClose={() => setAction(undefined)} />
      )}
      {action === "delete" && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setAction(undefined)}
          title={`Delete ${topic.name}?`}
          description="The topics after it move up one place."
          action="Delete"
          onConfirm={() => remove.mutateAsync(topic.id)}
          failure={
            lastOfPublished
              ? "A published event needs at least one topic. Add another first, or unpublish the event."
              : "Couldn't delete the topic. Try again."
          }
        />
      )}
    </>
  );
}

function Rename({ topic, competitionId, onClose }: { topic: Topic; competitionId: string; onClose: () => void }) {
  const id = useId();
  const rename = useMutation(updateTopicMutation(competitionId));
  const [name, setName] = useState(topic.name);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form
          className="grid gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            rename.mutate({ id: topic.id, name: name.trim() }, { onSuccess: onClose });
          }}
        >
          <DialogHeader>
            <DialogTitle>Rename topic</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={id}>Name</Label>
            <Input
              id={id}
              autoFocus
              required
              maxLength={100}
              autoComplete="off"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (rename.isError) rename.reset();
              }}
            />
            {rename.isError && (
              <p role="alert" className="text-sm text-destructive">
                Couldn't rename the topic. Try again.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={rename.isPending || !name.trim() || name.trim() === topic.name}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
