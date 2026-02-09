import { Medal } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime, getSubmissionImageUrl } from "./voting-utils";

interface LeaderboardEntry {
  submissionId: number;
  participantId: number;
  participantFirstName: string;
  participantLastName: string;
  rank: number;
  voteCount: number;
  isTie: boolean;
  tieSize: number;
  submissionCreatedAt: string;
  submissionThumbnailKey?: string | null;
  submissionKey?: string | null;
}

interface TopRankEntry {
  rank: number;
  entries: LeaderboardEntry[];
}

interface LeaderboardTabProps {
  totalVotes: number;
  topRanks: TopRankEntry[];
  leaderboard: LeaderboardEntry[];
}

export function LeaderboardTab({
  totalVotes,
  topRanks,
  leaderboard,
}: LeaderboardTabProps) {
  const topRankMap = new Map(
    topRanks.map((rank) => [rank.rank, rank.entries]),
  );

  return (
    <div className="space-y-6">
      <Card className="shadow-sm py-4">
        <CardHeader>
          <CardTitle className="font-rocgrotesk">Leaderboard</CardTitle>
          <CardDescription>
            Top placements with tie-aware ranking based on total votes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {totalVotes === 0 ? (
            <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-center">
              <p className="text-sm font-medium">
                Leaderboard will appear once votes are cast
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Start the voting session and wait for participants to submit
                their votes.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {[1, 2, 3].map((rank) => {
                const entries = topRankMap.get(rank) ?? [];
                const tone =
                  rank === 1
                    ? "text-amber-600"
                    : rank === 2
                      ? "text-slate-600"
                      : "text-orange-600";

                return (
                  <div
                    key={rank}
                    className="space-y-3 rounded-xl border bg-muted/30 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">
                        Place {rank}
                      </span>
                      <Medal className={`h-4 w-4 ${tone}`} />
                    </div>

                    {entries.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No ranked submission yet
                      </p>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          {entries.slice(0, 3).map((entry) => {
                            const imageUrl = getSubmissionImageUrl(
                              entry.submissionThumbnailKey,
                              entry.submissionKey,
                            );

                            return (
                              <div
                                key={`${entry.submissionId}-thumbnail`}
                                className="relative aspect-square overflow-hidden rounded-md border bg-muted"
                              >
                                {imageUrl ? (
                                  <img
                                    src={imageUrl}
                                    alt={`Submission ${entry.submissionId}`}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                                    No image
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        <div className="space-y-1.5">
                          {entries.map((entry) => (
                            <div key={entry.submissionId} className="text-sm">
                              <p className="font-medium">
                                {entry.participantFirstName}{" "}
                                {entry.participantLastName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Submission #{entry.submissionId} -{" "}
                                {entry.voteCount} votes
                              </p>
                            </div>
                          ))}
                          {entries.length > 1 ? (
                            <Badge variant="outline" className="mt-1">
                              Tie ({entries.length} submissions)
                            </Badge>
                          ) : null}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm py-4">
        <CardHeader>
          <CardTitle className="font-rocgrotesk">
            All Ranked Submissions
          </CardTitle>
          <CardDescription>
            Ordered by vote count descending, then upload time, then submission
            id.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Submission</TableHead>
                  <TableHead>Participant</TableHead>
                  <TableHead>Votes</TableHead>
                  <TableHead>Tie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.length ? (
                  leaderboard.map((entry) => (
                    <TableRow key={entry.submissionId}>
                      <TableCell className="font-medium">
                        #{entry.rank}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="font-medium">
                            Submission #{entry.submissionId}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Uploaded {formatDateTime(entry.submissionCreatedAt)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {entry.participantFirstName} {entry.participantLastName}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {entry.voteCount}
                      </TableCell>
                      <TableCell>
                        {entry.isTie ? (
                          <Badge variant="outline">
                            Tie ({entry.tieSize})
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
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
        </CardContent>
      </Card>
    </div>
  );
}
