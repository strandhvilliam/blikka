import { useEffect } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTRPC } from "@/lib/trpc/client";
import {
  formatDateTime,
  getSubmissionImageUrl,
  VOTING_PAGE_SIZE,
} from "../_lib/utils";
import { useDomain } from "@/lib/domain-provider";
import { useVotingUiState } from "../_hooks/use-voting-ui-state";

interface LeaderboardEntry {
  submissionId: number;
  participantId: number;
  participantFirstName: string;
  participantLastName: string;
  participantReference: string;
  rank: number;
  voteCount: number;
  isTie: boolean;
  tieSize: number;
  submissionCreatedAt: string;
  submissionThumbnailKey?: string | null;
  submissionKey?: string | null;
}

interface LeaderboardTabProps {
  activeTopic: { id: number };
}

const RANK_ACCENT = {
  1: "bg-brand-primary text-white",
  2: "bg-zinc-800 text-white",
  3: "bg-zinc-400 text-white",
} as const;

function getRankAccent(rank: number) {
  return (
    RANK_ACCENT[rank as keyof typeof RANK_ACCENT] ??
    "bg-zinc-200 text-zinc-600"
  );
}

function getOrdinal(n: number) {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}

export function LeaderboardTab({ activeTopic }: LeaderboardTabProps) {
  const router = useRouter();
  const trpc = useTRPC();
  const domain = useDomain();
  const { leaderboardPage, setLeaderboardPage } = useVotingUiState();

  const { data: summary } = useSuspenseQuery(
    trpc.voting.getVotingAdminSummary.queryOptions({
      domain,
      topicId: activeTopic.id,
    }),
  );

  const { data: leaderboardPageData } = useSuspenseQuery(
    trpc.voting.getVotingLeaderboardPage.queryOptions({
      domain,
      topicId: activeTopic.id,
      page: leaderboardPage,
      limit: VOTING_PAGE_SIZE,
    }),
  );

  const leaderboard = leaderboardPageData?.items ?? [];
  const pageCount = leaderboardPageData?.pageCount ?? 0;
  const total = leaderboardPageData?.total ?? 0;

  useEffect(() => {
    if (pageCount > 0 && leaderboardPage > pageCount) {
      setLeaderboardPage(pageCount);
    }
  }, [pageCount, leaderboardPage, setLeaderboardPage]);

  const handleRowClick = (entry: LeaderboardEntry) => {
    router.push(
      `/admin/${domain}/dashboard/submissions/${entry.participantReference}/${entry.submissionId}`,
    );
  };

  const topCardEntries = summary.topRanks
    .flatMap((rankGroup) =>
      [...rankGroup.entries].sort((entryA, entryB) => {
        const timeDiff =
          new Date(entryA.submissionCreatedAt).getTime() -
          new Date(entryB.submissionCreatedAt).getTime();
        if (timeDiff !== 0) return timeDiff;
        return entryA.submissionId - entryB.submissionId;
      }),
    )
    .sort((entryA, entryB) => {
      if (entryA.rank !== entryB.rank) return entryA.rank - entryB.rank;
      if (entryA.voteCount !== entryB.voteCount) {
        return entryB.voteCount - entryA.voteCount;
      }
      const timeDiff =
        new Date(entryA.submissionCreatedAt).getTime() -
        new Date(entryB.submissionCreatedAt).getTime();
      if (timeDiff !== 0) return timeDiff;
      return entryA.submissionId - entryB.submissionId;
    })
    .slice(0, 3);

  const maxVotes = leaderboard.reduce((max, entry) => {
    return Math.max(max, entry.voteCount);
  }, 0);

  const getDisplayName = (entry: LeaderboardEntry) =>
    `${entry.participantFirstName} ${entry.participantLastName}`.trim();

  if (summary.voteStats.totalVotes === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 px-6">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Trophy className="size-5 text-muted-foreground" />
        </div>
        <p className="mt-4 text-sm font-semibold text-foreground">
          No votes yet
        </p>
        <p className="mt-1 max-w-xs text-center text-sm text-muted-foreground">
          The leaderboard will populate once participants begin casting their
          votes.
        </p>
      </div>
    );
  }

  const winner = topCardEntries[0];
  const runnerUp = topCardEntries[1];
  const thirdPlace = topCardEntries[2];

  return (
    <div className="space-y-6">
      {summary.currentRound ? (
        <div className="flex flex-wrap items-center gap-2.5 text-sm text-muted-foreground">
          <Badge
            variant="outline"
            className="border-brand-primary/25 bg-brand-primary/5 text-brand-primary"
          >
            {summary.currentRound.kind === "tiebreak"
              ? `Tie-break ${summary.currentRound.roundNumber}`
              : `Round ${summary.currentRound.roundNumber}`}
          </Badge>
          {summary.currentRound.kind === "tiebreak" ? (
            <span className="text-xs">
              Only the tied leading submissions are shown in this round.
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Winner — full-width hero card */}
      <PodiumCard
        entry={winner}
        rank={1}
        variant="hero"
        getDisplayName={getDisplayName}
        onClick={winner ? () => handleRowClick(winner) : undefined}
      />

      {/* Runner-ups — side by side */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <PodiumCard
          entry={runnerUp}
          rank={2}
          variant="compact"
          getDisplayName={getDisplayName}
          onClick={runnerUp ? () => handleRowClick(runnerUp) : undefined}
        />
        <PodiumCard
          entry={thirdPlace}
          rank={3}
          variant="compact"
          getDisplayName={getDisplayName}
          onClick={thirdPlace ? () => handleRowClick(thirdPlace) : undefined}
        />
      </div>

      {/* Full results table */}
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow className="border-b bg-muted/30 hover:bg-muted/30">
                <TableHead className="h-9 bg-muted/50 text-xs font-semibold text-foreground">
                  Rank
                </TableHead>
                <TableHead className="h-9 bg-muted/50 text-xs font-semibold text-foreground">
                  Participant
                </TableHead>
                <TableHead className="h-9 bg-muted/50 text-xs font-semibold text-foreground">
                  Reference
                </TableHead>
                <TableHead className="h-9 bg-muted/50 text-xs font-semibold text-foreground">
                  Submitted
                </TableHead>
                <TableHead className="h-9 bg-muted/50 text-right text-xs font-semibold text-foreground">
                  Votes
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {leaderboard.length > 0 ? (
                leaderboard.map((entry) => {
                  const voteProgress =
                    maxVotes > 0 ? (entry.voteCount / maxVotes) * 100 : 0;

                  return (
                    <TableRow
                      key={entry.submissionId}
                      className="border-b transition-colors hover:bg-muted/60 cursor-pointer"
                      onClick={() => handleRowClick(entry)}
                    >
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex size-7 items-center justify-center rounded-full text-xs font-bold ${getRankAccent(entry.rank)}`}
                          >
                            {entry.rank}
                          </span>
                          {entry.isTie ? (
                            <Badge
                              variant="outline"
                              className="border-brand-primary/20 bg-brand-primary/5 text-[10px] text-brand-primary"
                            >
                              Tie ({entry.tieSize})
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <p className="text-sm font-medium">
                          {getDisplayName(entry)}
                        </p>
                      </TableCell>
                      <TableCell className="py-2">
                        <code className="font-mono text-xs">
                          {entry.participantReference}
                        </code>
                      </TableCell>
                      <TableCell className="py-2 text-sm text-muted-foreground">
                        {formatDateTime(entry.submissionCreatedAt)}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center justify-end gap-3">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-brand-primary transition-all duration-300"
                              style={{
                                width: `${Math.max(4, Math.min(100, voteProgress))}%`,
                              }}
                            />
                          </div>
                          <span className="w-8 text-right font-mono text-sm font-bold tabular-nums">
                            {entry.voteCount}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No submissions found for this topic.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {leaderboard.length} of {total} submissions
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() =>
              setLeaderboardPage(Math.max(1, leaderboardPage - 1))
            }
            disabled={leaderboardPage <= 1}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="px-2 text-xs tabular-nums text-muted-foreground">
            {pageCount === 0 ? 0 : leaderboardPage} / {pageCount}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() =>
              setLeaderboardPage(
                pageCount > 0
                  ? Math.min(pageCount, leaderboardPage + 1)
                  : leaderboardPage + 1,
              )
            }
            disabled={pageCount === 0 || leaderboardPage >= pageCount}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Podium Card ─── */

interface PodiumCardProps {
  entry: LeaderboardEntry | undefined;
  rank: number;
  variant: "hero" | "compact";
  getDisplayName: (entry: LeaderboardEntry) => string;
  onClick?: () => void;
}

function PodiumCard({
  entry,
  rank,
  variant,
  getDisplayName,
  onClick,
}: PodiumCardProps) {
  const accent = getRankAccent(rank);
  const imageUrl = entry
    ? getSubmissionImageUrl(
        entry.submissionThumbnailKey,
        entry.submissionKey,
      )
    : null;

  const isHero = variant === "hero";

  if (!entry) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-10">
        <div className="flex items-center gap-3 text-muted-foreground">
          <span
            className={`inline-flex size-8 items-center justify-center rounded-full text-sm font-bold opacity-40 ${accent}`}
          >
            {rank}
          </span>
          <span className="text-sm">
            {getOrdinal(rank)} place — awaiting submission
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group relative flex overflow-hidden rounded-lg border border-border bg-card shadow-sm ${
        onClick ? "cursor-pointer transition-shadow hover:shadow-md" : ""
      }`}
      onClick={onClick}
    >
      {/* Image */}
      <div
        className={`relative shrink-0 overflow-hidden bg-muted ${
          isHero ? "w-56 lg:w-72" : "w-36 lg:w-44"
        }`}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`Submission by ${getDisplayName(entry)}`}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
            No preview
          </div>
        )}
      </div>

      {/* Content */}
      <div
        className={`flex min-w-0 flex-1 flex-col justify-center ${
          isHero ? "p-5 lg:p-7" : "p-4"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span
            className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${accent} ${
              isHero ? "size-10 text-base" : "size-7 text-xs"
            }`}
          >
            {rank}
          </span>
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {getOrdinal(rank)} Place
          </span>
          {entry.isTie ? (
            <Badge
              variant="outline"
              className="border-brand-primary/20 bg-brand-primary/5 text-[10px] text-brand-primary"
            >
              Tie &middot; {entry.tieSize}
            </Badge>
          ) : null}
        </div>

        <p
          className={`mt-2 truncate font-semibold text-foreground ${
            isHero ? "text-lg" : "text-sm"
          }`}
        >
          {getDisplayName(entry)}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          #{entry.participantReference}
        </p>

        <div className={`flex items-baseline gap-1.5 ${isHero ? "mt-4" : "mt-3"}`}>
          <span
            className={`font-mono font-bold tabular-nums text-foreground ${
              isHero ? "text-3xl" : "text-xl"
            }`}
          >
            {entry.voteCount}
          </span>
          <span className="text-xs text-muted-foreground">
            vote{entry.voteCount !== 1 ? "s" : ""}
          </span>
        </div>

        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {formatDateTime(entry.submissionCreatedAt)}
        </p>
      </div>
    </div>
  );
}
