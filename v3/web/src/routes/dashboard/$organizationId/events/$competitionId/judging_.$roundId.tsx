import { IconArrowLeft, IconCopy, IconDots, IconTrophy } from "@tabler/icons-react";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@ui-sdk/react/button";
import { Field, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@ui-sdk/react/menu";
import { isApiError } from "@/api/client.ts";
import {
  createRoundMutation,
  deleteRoundMutation,
  describeRules,
  inviteJurorMutation,
  jurorLink,
  openRoundMutation,
  poolLabel,
  renewLinkMutation,
  type Result,
  resultsQuery,
  revokeVoterMutation,
  type Round,
  roundQuery,
  roundsQuery,
  roundState,
  updateRoundMutation,
  type Voter,
  votersQuery,
  voterLabels,
} from "@/api/rounds.ts";
import { topicsQuery } from "@/api/topics.ts";
import { Card } from "@/components/Card.tsx";
import { ConfirmDialog } from "@/components/ConfirmDialog.tsx";
import { Count, EmptyState } from "@/components/EmptyState.tsx";
import { PageHeader } from "@/components/PageHeader.tsx";
import { RoundStateBadge } from "@/components/RoundStateBadge.tsx";
import { Section } from "@/components/Section.tsx";

export const Route = createFileRoute("/dashboard/$organizationId/events/$competitionId/judging_/$roundId")({
  loader: async ({ context, params }) => {
    const round = await context.queryClient.ensureQueryData(roundQuery(params.roundId));

    if (!round || round.competition_id !== params.competitionId) {
      throw notFound();
    }

    await Promise.all([
      context.queryClient.ensureQueryData(roundsQuery(params.competitionId)),
      context.queryClient.ensureQueryData(topicsQuery(params.competitionId)),
      context.queryClient.ensureQueryData(resultsQuery(params.roundId)),
      context.queryClient.ensureQueryData(votersQuery(params.roundId)),
    ]);
  },
  component: RoundDetail,
});

function RoundDetail() {
  const { competition, organization } = Route.useRouteContext();
  const { roundId } = Route.useParams();
  const { data: rounds } = useSuspenseQuery(roundsQuery(competition.id));
  const { data: topics } = useSuspenseQuery(topicsQuery(competition.id));
  const round = rounds.find((r) => r.id === roundId);
  const canWrite = organization.permissions.includes("judging:write");
  const params = { organizationId: competition.organization_id, competitionId: competition.id };

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/dashboard/$organizationId/events/$competitionId/judging"
        params={params}
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground no-underline hover:text-foreground"
      >
        <IconArrowLeft aria-hidden className="size-4" />
        Judging
      </Link>
      {round && (
        <>
          <PageHeader
            title={
              <span className="flex flex-wrap items-center gap-3">
                {round.name}
                <RoundStateBadge round={round} />
              </span>
            }
            description={`${describeRules(round.rules)} · ${voterLabels[round.voters]} · ${poolLabel(round, topics, rounds)}`}
          >
            {canWrite && <RoundActions round={round} />}
          </PageHeader>
          <Voters round={round} canWrite={canWrite} />
          <Results round={round} canWrite={canWrite} />
        </>
      )}
    </div>
  );
}

function RoundActions({ round }: { round: Round }) {
  const open = useMutation(openRoundMutation(round));
  const update = useMutation(updateRoundMutation(round));
  const remove = useMutation(deleteRoundMutation(round));
  const navigate = useNavigate();
  const { organizationId } = Route.useParams();
  const [confirming, setConfirming] = useState(false);
  // oxlint-disable-next-line react/purity -- display only, recomputed on each render
  const state = roundState(round, new Date());
  const busy = open.isPending || update.isPending;

  const error =
    (open.error &&
      (isApiError(open.error, "RoundHasNoEntries")
        ? "There are no photos to vote on yet."
        : "Couldn't open the round. Try again.")) ||
    (update.error && "Couldn't save. Try again.");

  return (
    <>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {state === "Draft" && (
        <Button data-variant="solid" disabled={busy} onClick={() => open.mutate(null)}>
          Open round
        </Button>
      )}
      {state === "Open" && (
        <Button disabled={busy} onClick={() => update.mutate({ closes_at: new Date().toISOString() })}>
          Close now
        </Button>
      )}
      {state === "Closed" && (
        <Button disabled={busy} onClick={() => update.mutate({ closes_at: null })}>
          Reopen
        </Button>
      )}
      <Menu>
        <MenuTrigger
          aria-label="More actions"
          className="size-8 border-transparent bg-transparent p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <IconDots aria-hidden />
        </MenuTrigger>
        <MenuContent align="end">
          <MenuItem destructive onSelect={() => setConfirming(true)}>
            Delete round
          </MenuItem>
        </MenuContent>
      </Menu>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Delete ${round.name}?`}
        description="Its voters lose access, and its votes and results are gone from Blikka."
        action="Delete round"
        failure="Couldn't delete the round. Try again."
        onConfirm={() =>
          remove.mutateAsync().then(() =>
            navigate({
              to: "/dashboard/$organizationId/events/$competitionId/judging",
              params: { organizationId, competitionId: round.competition_id },
            }),
          )
        }
      />
    </>
  );
}

function Voters({ round, canWrite }: { round: Round; canWrite: boolean }) {
  const { data: voters } = useSuspenseQuery(votersQuery(round.id));
  const [link, setLink] = useState<{ name: string; url: string } | null>(null);

  if (round.voters === "participants") {
    return (
      <Section
        title="Voters"
        description="Participants vote from their entry page while the round is open. Their own photos are left out."
        aside={
          <span className="text-sm text-muted-foreground">
            {round.voted} {round.voted === 1 ? "has" : "have"} voted
          </span>
        }
      />
    );
  }

  return (
    <Section
      title={
        <span className="flex items-center gap-2">
          Jury <Count>{voters.length}</Count>
        </span>
      }
      description="Each juror gets a personal link. Send it to them yourself. Blikka doesn't email it yet."
    >
      {link && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-page p-3">
          <p className="text-sm">
            Link for <span className="font-medium">{link.name}</span>. It is shown once. Copy it now.
          </p>
          <div className="flex items-center gap-2">
            <Input readOnly aria-label="Juror link" value={link.url} className="font-mono text-xs" />
            <Button aria-label="Copy link" onClick={() => void navigator.clipboard.writeText(link.url)}>
              <IconCopy aria-hidden />
            </Button>
          </div>
        </div>
      )}
      {voters.length > 0 && (
        <ul className="-mx-5 border-y border-border">
          {voters.map((voter) => (
            <JurorRow
              key={voter.id}
              round={round}
              voter={voter}
              canWrite={canWrite}
              onLink={(url) => setLink({ name: voter.name, url })}
            />
          ))}
        </ul>
      )}
      {canWrite && <InviteJuror round={round} onLink={setLink} />}
    </Section>
  );
}

function JurorRow({
  round,
  voter,
  canWrite,
  onLink,
}: {
  round: Round;
  voter: Voter;
  canWrite: boolean;
  onLink: (url: string) => void;
}) {
  const renew = useMutation(renewLinkMutation(round));
  const revoke = useMutation(revokeVoterMutation(round));

  return (
    <li className="flex items-center gap-3 border-b border-border px-5 py-2.5 last:border-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium wrap-anywhere">{voter.name}</span>
        <span className="truncate text-sm text-muted-foreground">{voter.email}</span>
      </div>
      <span className="text-sm text-muted-foreground">
        {voter.submitted_at ? "Done" : voter.votes > 0 ? `${voter.votes} votes` : "Not started"}
      </span>
      {canWrite && (
        <Menu>
          <MenuTrigger
            aria-label={`Actions for ${voter.name}`}
            className="size-8 border-transparent bg-transparent p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <IconDots aria-hidden />
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem onSelect={() => renew.mutate(voter.id, { onSuccess: ({ token }) => onLink(jurorLink(token)) })}>
              New link
            </MenuItem>
            <MenuItem destructive onSelect={() => revoke.mutate(voter.id)}>
              Remove
            </MenuItem>
          </MenuContent>
        </Menu>
      )}
    </li>
  );
}

function InviteJuror({ round, onLink }: { round: Round; onLink: (link: { name: string; url: string }) => void }) {
  const invite = useMutation(inviteJurorMutation(round));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const error =
    invite.error &&
    (isApiError(invite.error, "VoterAlreadyInvited")
      ? "That email is already on this jury."
      : "Couldn't add the juror. Try again.");

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        invite.mutate(
          { name: name.trim(), email: email.trim() },
          {
            onSuccess: ({ voter, token }) => {
              onLink({ name: voter.name, url: jurorLink(token) });
              setName("");
              setEmail("");
            },
          },
        );
      }}
      onChange={() => invite.isError && invite.reset()}
    >
      <div className="flex flex-wrap items-end gap-3">
        <Field className="min-w-40 flex-1">
          <FieldLabel>Name</FieldLabel>
          <Input required maxLength={100} value={name} onValueChange={setName} />
        </Field>
        <Field className="min-w-48 flex-1">
          <FieldLabel>Email</FieldLabel>
          <Input
            type="email"
            required
            maxLength={254}
            autoComplete="off"
            placeholder="name@example.com"
            value={email}
            onValueChange={setEmail}
          />
        </Field>
        <Button type="submit" disabled={invite.isPending || !name.trim() || !email.trim()}>
          Add juror
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}

const tiedForFirst = (results: ReadonlyArray<Result>) => {
  const first = results.filter((result) => result.rank === 1);

  return first.length > 1 && first.some((result) => result.votes > 0) ? first : [];
};

function Results({ round, canWrite }: { round: Round; canWrite: boolean }) {
  const { data: results } = useSuspenseQuery(resultsQuery(round.id));
  const create = useMutation(createRoundMutation(round.competition_id));
  const navigate = useNavigate();
  const { organizationId } = Route.useParams();
  const sorted = [...results].sort((a, b) => a.rank - b.rank);
  // oxlint-disable-next-line react/purity -- display only, recomputed on each render
  const closed = roundState(round, new Date()) === "Closed";
  const tied = closed ? tiedForFirst(results) : [];
  const isRating = round.rules.method === "rating";

  const tiebreak = () =>
    create.mutate(
      {
        name: `${round.name} tiebreak`,
        voters: round.voters,
        rules: isRating ? round.rules : { method: "pick", max_votes: 1, favorite: false },
        source_round_id: round.id,
        submission_ids: tied.map((result) => result.submission_id),
      },
      {
        onSuccess: (created) =>
          navigate({
            to: "/dashboard/$organizationId/events/$competitionId/judging/$roundId",
            params: { organizationId, competitionId: round.competition_id, roundId: created.id },
          }),
      },
    );

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="font-semibold">Results</h2>
          <p className="text-sm text-muted-foreground">
            {round.opens_at ? "Counted live. Voters never see who took a photo." : "Shown once the round opens."}
          </p>
        </div>
        {canWrite && tied.length > 0 && (
          <Button disabled={create.isPending} onClick={tiebreak}>
            Tiebreak for {tied.length} tied
          </Button>
        )}
      </div>
      {sorted.length === 0 ? (
        <EmptyState
          icon={IconTrophy}
          title="No photos in this round yet"
          description="The photos are added when the round opens."
        />
      ) : (
        <table className="w-full text-sm">
          <thead className="border-y border-border bg-page text-xs text-muted-foreground">
            <tr>
              <th className="h-9 w-14 px-5 text-start font-medium">#</th>
              <th className="px-3 text-start font-medium">Participant</th>
              <th className="px-3 text-start font-medium max-sm:hidden">Topic</th>
              {isRating ? (
                <th className="w-24 px-3 text-end font-medium">Average</th>
              ) : round.rules.method === "pick" && round.rules.favorite ? (
                <th className="w-24 px-3 text-end font-medium">Favorites</th>
              ) : null}
              <th className="w-20 px-5 text-end font-medium">{isRating ? "Ratings" : "Votes"}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((result) => (
              <tr key={result.submission_id} className="border-b border-border last:border-0">
                <td className="h-10 px-5 font-mono text-xs">{result.rank}</td>
                <td className="px-3 font-medium wrap-anywhere">{result.participant_name}</td>
                <td className="px-3 text-muted-foreground max-sm:hidden">
                  {result.topic_position}. {result.topic_name}
                </td>
                {isRating ? (
                  <td className="px-3 text-end font-mono text-xs">
                    {result.average === null ? "–" : result.average.toFixed(2)}
                  </td>
                ) : round.rules.method === "pick" && round.rules.favorite ? (
                  <td className="px-3 text-end font-mono text-xs">{result.favorites}</td>
                ) : null}
                <td className="px-5 text-end font-mono text-xs">{result.votes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
