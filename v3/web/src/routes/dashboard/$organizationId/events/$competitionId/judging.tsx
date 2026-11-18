import { IconPlus, IconTrophy } from "@tabler/icons-react";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@ui-sdk/react/button";
import {
  Dialog,
  DialogBackdrop,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@ui-sdk/react/dialog";
import { Field, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { NumberInput, NumberInputControl, NumberInputGroup } from "@ui-sdk/react/number-input";
import { Radio, RadioGroup, RadioIndicator } from "@ui-sdk/react/radio";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui-sdk/react/select";
import { Switch, SwitchThumb } from "@ui-sdk/react/switch";
import {
  createRoundMutation,
  describeRules,
  poolLabel,
  type Round,
  type RoundRules,
  roundsQuery,
  voterLabels,
} from "@/api/rounds.ts";
import { type Topic, topicsQuery } from "@/api/topics.ts";
import { Card } from "@/components/Card.tsx";
import { EmptyState } from "@/components/EmptyState.tsx";
import { PageHeader } from "@/components/PageHeader.tsx";
import { RoundStateBadge } from "@/components/RoundStateBadge.tsx";

export const Route = createFileRoute("/dashboard/$organizationId/events/$competitionId/judging")({
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(roundsQuery(params.competitionId)),
      context.queryClient.ensureQueryData(topicsQuery(params.competitionId)),
    ]),
  component: Judging,
});

function Judging() {
  const { competition, organization } = Route.useRouteContext();
  const { data: rounds } = useSuspenseQuery(roundsQuery(competition.id));
  const { data: topics } = useSuspenseQuery(topicsQuery(competition.id));
  const canWrite = organization.permissions.includes("judging:write");

  return (
    <>
      <PageHeader title="Judging" description="Rounds where a jury or the participants vote on the photos.">
        {canWrite && <NewRound competitionId={competition.id} topics={topics} />}
      </PageHeader>
      <Card className="overflow-hidden">
        {rounds.length === 0 ? (
          <EmptyState
            icon={IconTrophy}
            title="No rounds yet"
            description="A round lets a jury rate the photos or the participants pick their favorites."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-page text-xs text-muted-foreground">
              <tr>
                <th className="h-9 px-5 text-start font-medium">Round</th>
                <th className="px-3 text-start font-medium max-md:hidden">Photos</th>
                <th className="px-3 text-start font-medium max-sm:hidden">Voters</th>
                <th className="w-20 px-3 text-end font-medium">Voted</th>
                <th className="w-28 px-5 text-end font-medium">State</th>
              </tr>
            </thead>
            <tbody>
              {rounds.map((round) => (
                <tr
                  key={round.id}
                  className="relative border-b border-border last:border-0 hover:bg-muted/40 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:-outline-offset-2 has-[a:focus-visible]:outline-ring"
                >
                  <td className="h-12 px-5">
                    <Link
                      to="/dashboard/$organizationId/events/$competitionId/judging/$roundId"
                      params={{
                        organizationId: competition.organization_id,
                        competitionId: competition.id,
                        roundId: round.id,
                      }}
                      className="font-medium no-underline outline-none wrap-anywhere after:absolute after:inset-0"
                    >
                      {round.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{describeRules(round.rules)}</p>
                  </td>
                  <td className="px-3 text-muted-foreground max-md:hidden">{poolLabel(round, topics, rounds)}</td>
                  <td className="px-3 text-muted-foreground max-sm:hidden">{voterLabels[round.voters]}</td>
                  <td className="px-3 text-end font-mono text-xs">{round.voted}</td>
                  <td className="px-5 text-end">
                    <RoundStateBadge round={round} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}

type Method = RoundRules["method"];

function NewRound({ competitionId, topics }: { competitionId: string; topics: ReadonlyArray<Topic> }) {
  const create = useMutation(createRoundMutation(competitionId));
  const navigate = useNavigate();
  const { organizationId } = Route.useParams();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [voters, setVoters] = useState<Round["voters"]>("jury");
  const [method, setMethod] = useState<Method>("rating");
  const [maxVotes, setMaxVotes] = useState<number | null>(1);
  const [favorite, setFavorite] = useState(false);
  const [scale, setScale] = useState<5 | 10>(5);
  const [topicId, setTopicId] = useState("all");

  const reset = () => {
    setName("");
    setVoters("jury");
    setMethod("rating");
    setMaxVotes(1);
    setFavorite(false);
    setScale(5);
    setTopicId("all");
    create.reset();
  };

  const rules: RoundRules = method === "pick" ? { method, max_votes: maxVotes ?? 1, favorite } : { method, scale };

  const topicItems = [
    { value: "all", label: "All topics" },
    ...topics.map((topic) => ({ value: topic.id, label: `${topic.position}. ${topic.name}` })),
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        reset();
      }}
    >
      <DialogTrigger data-variant="solid">
        <IconPlus aria-hidden />
        New round
      </DialogTrigger>
      <DialogBackdrop />
      <DialogContent className="max-w-lg">
        <DialogTitle>New round</DialogTitle>
        <DialogDescription>The photos are fixed when you open the round.</DialogDescription>
        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(
              { name: name.trim(), voters, rules, topic_id: topicId === "all" ? null : topicId },
              {
                onSuccess: (round) =>
                  navigate({
                    to: "/dashboard/$organizationId/events/$competitionId/judging/$roundId",
                    params: { organizationId, competitionId, roundId: round.id },
                  }),
              },
            );
          }}
        >
          <Field>
            <FieldLabel>Name</FieldLabel>
            <Input autoFocus required maxLength={100} placeholder="Jury round" value={name} onValueChange={setName} />
          </Field>
          <fieldset className="flex flex-col gap-3">
            <legend id="round-voters" className="mb-3 text-sm font-medium">
              Who votes?
            </legend>
            <RadioGroup
              aria-labelledby="round-voters"
              value={voters}
              onValueChange={(value) => setVoters(value === "participants" ? "participants" : "jury")}
              className="flex flex-col gap-3"
            >
              <label data-slot="label" className="flex items-center gap-2">
                <Radio value="jury">
                  <RadioIndicator />
                </Radio>
                A jury you invite by email
              </label>
              <label data-slot="label" className="flex items-center gap-2">
                <Radio value="participants">
                  <RadioIndicator />
                </Radio>
                The participants, on everyone else's photos
              </label>
            </RadioGroup>
          </fieldset>
          <fieldset className="flex flex-col gap-3">
            <legend id="round-method" className="mb-3 text-sm font-medium">
              How do they vote?
            </legend>
            <RadioGroup
              aria-labelledby="round-method"
              value={method}
              onValueChange={(value) => setMethod(value === "pick" ? "pick" : "rating")}
              className="flex flex-col gap-3"
            >
              <label data-slot="label" className="flex items-center gap-2">
                <Radio value="rating">
                  <RadioIndicator />
                </Radio>
                Rate every photo with stars
              </label>
              <label data-slot="label" className="flex items-center gap-2">
                <Radio value="pick">
                  <RadioIndicator />
                </Radio>
                Pick their favorites
              </label>
            </RadioGroup>
            {method === "rating" ? (
              <RadioGroup
                aria-label="Stars"
                value={String(scale)}
                onValueChange={(value) => setScale(value === "10" ? 10 : 5)}
                className="ms-6 flex gap-4"
              >
                <label data-slot="label" className="flex items-center gap-2">
                  <Radio value="5">
                    <RadioIndicator />
                  </Radio>
                  5 stars
                </label>
                <label data-slot="label" className="flex items-center gap-2">
                  <Radio value="10">
                    <RadioIndicator />
                  </Radio>
                  10 stars
                </label>
              </RadioGroup>
            ) : (
              <div className="ms-6 flex flex-col gap-3">
                <label data-slot="label" className="flex items-center gap-3">
                  Picks per voter
                  <NumberInput value={maxVotes} onValueChange={setMaxVotes} min={1} max={100} step={1}>
                    <NumberInputGroup className="w-24">
                      <NumberInputControl aria-label="Picks per voter" />
                    </NumberInputGroup>
                  </NumberInput>
                </label>
                <label data-slot="label" className="flex items-center gap-3">
                  <Switch checked={favorite} onCheckedChange={setFavorite}>
                    <SwitchThumb />
                  </Switch>
                  Each voter also marks one favorite
                </label>
              </div>
            )}
          </fieldset>
          <Field>
            <FieldLabel>Photos</FieldLabel>
            <Select items={topicItems} value={topicId} onValueChange={(value) => setTopicId(value ?? "all")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {topicItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {create.isError && (
            <p role="alert" className="text-sm text-destructive">
              Couldn't create the round. Try again.
            </p>
          )}
          <Button
            type="submit"
            data-variant="solid"
            className="self-end"
            disabled={create.isPending || !name.trim() || (method === "pick" && !maxVotes)}
          >
            Create round
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
