import { Medal, RefreshCw } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDateTime, getSubmissionImageUrl } from "./voting-utils"

interface LeaderboardEntry {
  submissionId: number
  participantId: number
  participantFirstName: string
  participantLastName: string
  rank: number
  voteCount: number
  isTie: boolean
  tieSize: number
  submissionCreatedAt: string
  submissionThumbnailKey?: string | null
  submissionKey?: string | null
}

interface TopRankEntry {
  rank: number
  entries: LeaderboardEntry[]
}

interface LeaderboardTabProps {
  totalVotes: number
  topRanks: TopRankEntry[]
  leaderboard: LeaderboardEntry[]
  page: number
  pageCount: number
  total: number
  isPageLoading: boolean
  onPreviousPage: () => void
  onNextPage: () => void
}

export function LeaderboardTab({
  totalVotes,
  topRanks,
  leaderboard,
  page,
  pageCount,
  total,
  isPageLoading,
  onPreviousPage,
  onNextPage,
}: LeaderboardTabProps) {
  const topCardEntries = topRanks
    .flatMap((rankGroup) =>
      [...rankGroup.entries].sort((entryA, entryB) => {
        const timeDiff =
          new Date(entryA.submissionCreatedAt).getTime() -
          new Date(entryB.submissionCreatedAt).getTime()
        if (timeDiff !== 0) return timeDiff
        return entryA.submissionId - entryB.submissionId
      }),
    )
    .sort((entryA, entryB) => {
      if (entryA.rank !== entryB.rank) return entryA.rank - entryB.rank
      if (entryA.voteCount !== entryB.voteCount) {
        return entryB.voteCount - entryA.voteCount
      }
      const timeDiff =
        new Date(entryA.submissionCreatedAt).getTime() -
        new Date(entryB.submissionCreatedAt).getTime()
      if (timeDiff !== 0) return timeDiff
      return entryA.submissionId - entryB.submissionId
    })
    .slice(0, 3)

  const maxVotes = leaderboard.reduce((max, entry) => {
    return Math.max(max, entry.voteCount)
  }, 0)

  const getDisplayName = (entry: LeaderboardEntry) =>
    `${entry.participantFirstName} ${entry.participantLastName}`.trim()


  const getMedalTone = (rank: number) => {
    if (rank === 1) return "text-amber-500"
    if (rank === 2) return "text-slate-500"
    if (rank === 3) return "text-orange-500"
    return "text-muted-foreground"
  }

  const getRankBadgeClass = (rank: number) => {
    if (rank === 1) {
      return "border-amber-300 bg-gradient-to-b from-amber-100 to-amber-50 text-amber-800 shadow-amber-200/80"
    }
    if (rank === 2) {
      return "border-slate-300 bg-gradient-to-b from-slate-100 to-slate-50 text-slate-700 shadow-slate-200/80"
    }
    if (rank === 3) {
      return "border-orange-300 bg-gradient-to-b from-orange-100 to-orange-50 text-orange-800 shadow-orange-200/80"
    }

    return "border-zinc-300 bg-gradient-to-b from-zinc-100 to-zinc-50 text-zinc-700 shadow-zinc-200/70"
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardContent className="p-3 sm:p-4 md:p-5">
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
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {[0, 1, 2].map((cardIndex) => {
                  const entry = topCardEntries[cardIndex]
                  const displayRank = entry?.rank ?? cardIndex + 1
                  const tone = getMedalTone(displayRank)
                  const imageUrl = entry
                    ? getSubmissionImageUrl(
                      entry.submissionThumbnailKey,
                      entry.submissionKey,
                    )
                    : null

                  return (
                    <div
                      key={`top-card-${cardIndex}`}
                      className="relative overflow-hidden rounded-2xl border border-border/70 bg-white p-4"
                    >
                      {entry ? (
                        <>
                          <div className="flex items-center gap-3">
                            <div
                              className={`relative flex size-12 shrink-0 items-center justify-center rounded-full border text-base font-black tracking-tight shadow-md ${getRankBadgeClass(displayRank)}`}
                            >
                              <span className="absolute inset-[3px] rounded-full border border-white/80" />
                              <span className="relative leading-none text-xl">
                                {displayRank}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">
                                {getDisplayName(entry)}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                Submission Id #{entry.submissionId}
                              </p>
                            </div>
                            <div className="flex ml-auto items-center justify-between">
                              <Medal className={`h-4 w-4 ${tone}`} />
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-border/60 bg-white/80 p-2">
                            <div>
                              <p className="text-[10px] uppercase text-muted-foreground">
                                Votes
                              </p>
                              <p className="text-sm font-semibold">
                                {entry.voteCount}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase text-muted-foreground">
                                Rank
                              </p>
                              <p className="text-sm font-semibold">
                                {entry.rank}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase text-muted-foreground">
                                Uploaded
                              </p>
                              <p className="text-xs font-medium">
                                {formatDateTime(entry.submissionCreatedAt)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 overflow-hidden rounded-lg border bg-muted/50">
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt={`Submission ${entry.submissionId}`}
                                className="aspect-[16/9] w-full object-cover"
                              />
                            ) : (
                              <div className="flex aspect-[16/9] items-center justify-center text-xs text-muted-foreground">
                                No image preview
                              </div>
                            )}
                          </div>

                          {entry.isTie ? (
                            <Badge variant="outline" className="mt-3 bg-white">
                              Tie ({entry.tieSize} submissions)
                            </Badge>
                          ) : null}
                        </>
                      ) : (
                        <div className="mt-3 rounded-lg border border-dashed bg-white/70 p-4 text-sm text-muted-foreground">
                          No ranked submission yet
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="flex items-start justify-between gap-4">
              </div>

              <div className="overflow-hidden rounded-2xl border border-border/80 bg-white">
                <Table className="min-w-[760px]">
                  <TableHeader className="bg-muted/40">
                    <TableRow className="border-b border-border/70 bg-muted/40 hover:bg-muted/40">
                      <TableHead className="h-10 px-4 text-xs font-semibold">
                        Rank
                      </TableHead>
                      <TableHead className="h-10 px-4 text-xs font-semibold">
                        Participant
                      </TableHead>
                      <TableHead className="h-10 px-4 text-xs font-semibold">
                        Submission
                      </TableHead>
                      <TableHead className="h-10 px-4 text-xs font-semibold">
                        Uploaded
                      </TableHead>
                      <TableHead className="h-10 px-4 text-xs font-semibold">
                        Votes
                      </TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {isPageLoading && !leaderboard.length ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="h-24 text-center text-muted-foreground"
                        >
                          Loading leaderboard...
                        </TableCell>
                      </TableRow>
                    ) : leaderboard.length ? (
                      leaderboard.map((entry) => {
                        const voteProgress =
                          maxVotes > 0 ? (entry.voteCount / maxVotes) * 100 : 0

                        return (
                          <TableRow
                            key={entry.submissionId}
                            className="border-b border-border/70 hover:bg-amber-50/30"
                          >
                            <TableCell className="px-4 py-3 font-semibold">
                              {entry.rank}
                              {entry.isTie && (
                                <Badge
                                  variant="outline"
                                  className="ml-2 border-amber-300 bg-amber-50 text-amber-700"
                                >
                                  Tie ({entry.tieSize})
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <p className="text-sm font-medium">
                                  {getDisplayName(entry)}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="px-4 py-3 font-medium">
                              #{entry.submissionId}
                            </TableCell>
                            <TableCell className="px-4 py-3 text-muted-foreground">
                              {formatDateTime(entry.submissionCreatedAt)}
                            </TableCell>
                            <TableCell className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold">
                                  {entry.voteCount}
                                </p>
                                <div className="h-1.5 w-24 rounded-full bg-muted">
                                  <div
                                    className="h-full rounded-full bg-orange-400"
                                    style={{
                                      width: `${Math.max(
                                        10,
                                        Math.min(100, voteProgress),
                                      )}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="h-24 text-center text-muted-foreground"
                        >
                          No submissions found for this topic.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {leaderboard.length} of {total} submissions
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onPreviousPage}
                    disabled={isPageLoading || page <= 1}
                    className="bg-white"
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {pageCount === 0 ? 0 : page} of {pageCount}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onNextPage}
                    disabled={
                      isPageLoading || pageCount === 0 || page >= pageCount
                    }
                    className="bg-white"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
