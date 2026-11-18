import { IconPhoto, IconStarFilled } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@ui-sdk/react/button";
import { Rating, RatingItem } from "@ui-sdk/react/rating";
import { Toggle, ToggleIcon } from "@ui-sdk/react/toggle";
import { isApiError } from "@/api/client.ts";
import {
  type BallotAuth,
  type BallotDetail,
  type BallotVote,
  submitBallotMutation,
  unvoteMutation,
  voteMutation,
} from "@/api/ballots.ts";
import { describeRules, roundState } from "@/api/rounds.ts";
import { formatIn } from "@/lib/timeZone.ts";

type Entry = BallotDetail["entries"][number];

const voteError = (error: Error) => {
  if (isApiError(error, "VoteLimitReached")) {
    return "You've used all your picks. Remove one to pick another.";
  }

  if (isApiError(error, "RoundNotOpen")) {
    return "Voting has closed.";
  }

  if (isApiError(error, "BallotSubmitted")) {
    return "Your votes are already in.";
  }

  return "Couldn't save your vote. Try again.";
};

export function BallotView({ auth, detail }: { auth: BallotAuth; detail: BallotDetail }) {
  const { ballot, entries, votes } = detail;
  const vote = useMutation(voteMutation(auth, ballot.id));
  const unvote = useMutation(unvoteMutation(auth, ballot.id));
  const submit = useMutation(submitBallotMutation(auth, ballot.id));
  const state = roundState(ballot);
  const locked = state !== "Open" || ballot.submitted_at !== null;
  const byEntry = new Map(votes.map((v) => [v.submission_id, v]));
  const error = vote.error ?? unvote.error ?? submit.error;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">{ballot.competition_name}</p>
        <h1 className="text-2xl font-semibold text-balance">{ballot.round_name}</h1>
        <p className="text-sm text-muted-foreground">
          {describeRules(ballot.rules)}. {status(detail)}
        </p>
      </header>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">There is nothing for you to vote on in this round.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => (
            <EntryCard
              key={entry.submission_id}
              entry={entry}
              detail={detail}
              current={byEntry.get(entry.submission_id)}
              disabled={locked || vote.isPending || unvote.isPending}
              onVote={(body) => {
                unvote.reset();
                vote.mutate({ submissionId: entry.submission_id, ...body });
              }}
              onUnvote={() => {
                vote.reset();
                unvote.mutate(entry.submission_id);
              }}
            />
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {voteError(error)}
        </p>
      )}
      {!locked && entries.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
          <p className="me-auto text-sm text-muted-foreground">{progress(detail)}</p>
          <Button
            data-variant="solid"
            disabled={submit.isPending || votes.length === 0}
            onClick={() => submit.mutate()}
          >
            I'm done
          </Button>
        </div>
      )}
    </div>
  );
}

function status({ ballot }: BallotDetail) {
  const state = roundState(ballot);

  if (state === "Closed") {
    return "Voting has closed.";
  }

  if (ballot.submitted_at) {
    return "Your votes are in. Thank you.";
  }

  if (ballot.closes_at) {
    return `Open until ${formatIn(new Date(ballot.closes_at), ballot.time_zone)}.`;
  }

  return "";
}

function progress({ ballot, entries, votes }: BallotDetail) {
  if (ballot.rules.method === "rating") {
    return `${votes.length} of ${entries.length} rated`;
  }

  return `${votes.length} of ${ballot.rules.max_votes} picked`;
}

function EntryCard({
  entry,
  detail,
  current,
  disabled,
  onVote,
  onUnvote,
}: {
  entry: Entry;
  detail: BallotDetail;
  current: BallotVote | undefined;
  disabled: boolean;
  onVote: (body: { value?: number; favorite?: boolean }) => void;
  onUnvote: () => void;
}) {
  const { rules } = detail.ballot;
  const label = `Entry ${entry.number}`;

  return (
    <li className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid aspect-[4/3] place-items-center bg-muted text-muted-foreground">
        <IconPhoto aria-hidden className="size-8" stroke={1.25} />
      </div>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium">{label}</span>
          <span className="truncate text-sm text-muted-foreground">
            {entry.topic_position}. {entry.topic_name}
          </span>
        </div>
        {rules.method === "rating" ? (
          <Rating
            aria-label={`Rating for ${label}`}
            max={rules.scale}
            value={current?.value ?? null}
            disabled={disabled}
            onValueChange={(value) => (value === null ? onUnvote() : onVote({ value }))}
            className="flex [&_[data-slot=rating-item]]:text-border [&_[data-slot=rating-item][data-filled]]:text-golden-hour"
          >
            <RatingItem>
              <IconStarFilled aria-hidden className="size-5" />
            </RatingItem>
          </Rating>
        ) : (
          <div className="flex items-center gap-1">
            {rules.favorite && current && (
              <Toggle
                aria-label={`Favorite: ${label}`}
                pressed={current.favorite}
                disabled={disabled}
                onPressedChange={(favorite) => onVote({ favorite })}
                className="size-8 border-transparent bg-transparent p-0 text-muted-foreground aria-pressed:text-golden-hour"
              >
                <ToggleIcon>
                  <IconStarFilled />
                </ToggleIcon>
              </Toggle>
            )}
            <Toggle
              aria-label={`Pick ${label}`}
              pressed={current !== undefined}
              disabled={disabled}
              onPressedChange={(picked) => (picked ? onVote({}) : onUnvote())}
              className="aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background"
            >
              {current ? "Picked" : "Pick"}
            </Toggle>
          </div>
        )}
      </div>
    </li>
  );
}
