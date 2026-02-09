import { Copy, Loader2, Mail, MessageSquare, Send, ExternalLink, MoreVertical, Trash2, X } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useDomain } from "@/lib/domain-provider"
import { formatDateTime, getSubmissionImageUrl } from "../_lib/utils"

interface VoteSubmission {
  submissionId: number
  participantReference: string | null
  participantFirstName: string | null
  participantLastName: string | null
  thumbnailKey: string | null
  key: string | null
  createdAt: string
}

interface Voter {
  sessionId: number
  firstName: string
  lastName: string
  email: string | null
  phoneNumber: string | null
  token: string
  notificationLastSentAt: string | null
  connectedParticipantId: number | null
  voteSubmission: VoteSubmission | null
}

interface VotersTabProps {
  voters: Voter[]
  page: number
  pageCount: number
  total: number
  isPageLoading: boolean
  onPreviousPage: () => void
  onNextPage: () => void
  onCopyLink: (token: string) => void
  onResendNotification: (sessionId: number) => void
  pendingResendSessionId: number | null
  isResending: boolean
  onClearVote: (sessionId: number) => void
  onDeleteSession: (sessionId: number) => void
  pendingClearVoteSessionId: number | null
  pendingDeleteSessionId: number | null
  isClearingVote: boolean
  isDeletingSession: boolean
}

export function VotersTab({
  voters,
  page,
  pageCount,
  total,
  isPageLoading,
  onPreviousPage,
  onNextPage,
  onCopyLink,
  onResendNotification,
  pendingResendSessionId,
  isResending,
  onClearVote,
  onDeleteSession,
  pendingClearVoteSessionId,
  pendingDeleteSessionId,
  isClearingVote,
  isDeletingSession,
}: VotersTabProps) {
  const domain = useDomain()

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Voting Sessions</h2>
        <p className="text-sm text-muted-foreground">
          All voters for this topic, including manual invites and participant
          sessions.
        </p>
      </div>
      <div>
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow className="border-b bg-muted/30 hover:bg-muted/30">
                  <TableHead className="h-9 bg-muted/50 text-xs font-semibold text-foreground">
                    Voter
                  </TableHead>
                  <TableHead className="h-9 bg-muted/50 text-xs font-semibold text-foreground">
                    Token
                  </TableHead>
                  <TableHead className="h-9 bg-muted/50 text-xs font-semibold text-foreground">
                    Email
                  </TableHead>
                  <TableHead className="h-9 bg-muted/50 text-xs font-semibold text-foreground">
                    Phone
                  </TableHead>
                  <TableHead className="h-9 bg-muted/50 text-xs font-semibold text-foreground">
                    Vote
                  </TableHead>
                  <TableHead className="h-9 bg-muted/50 text-right text-xs font-semibold text-foreground">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isPageLoading && !voters.length ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Loading voting sessions...
                    </TableCell>
                  </TableRow>
                ) : voters.length ? (
                  voters.map((voter) => (
                    <TableRow
                      key={voter.sessionId}
                      className="border-b transition-colors hover:bg-muted/60"
                    >
                      <TableCell className="py-2">
                        <div className="space-y-1 flex items-center gap-2">
                          <p className="font-medium">
                            {voter.firstName} {voter.lastName}
                          </p>
                          <Badge variant="outline" className="text-xs">
                            {voter.connectedParticipantId
                              ? "Participant"
                              : "Manual"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <code className="font-mono text-xs">{voter.token}</code>
                      </TableCell>
                      <TableCell className="py-2">{voter.email || "-"}</TableCell>
                      <TableCell className="py-2">
                        {voter.phoneNumber || "-"}
                      </TableCell>
                      <TableCell className="py-2">
                        {voter.voteSubmission ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="inline-flex">
                                <Badge
                                  variant="secondary"
                                  className="cursor-pointer hover:bg-secondary/80"
                                >
                                  {voter.voteSubmission.participantReference || "Unknown"}
                                </Badge>
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-4" align="start">
                              <div className="space-y-3">
                                <div className="space-y-1">
                                  <h4 className="font-semibold text-sm">Voted Submission</h4>
                                  <p className="text-xs text-muted-foreground">
                                    Participant: {voter.voteSubmission.participantReference || "Unknown"}
                                  </p>
                                  {voter.voteSubmission.participantFirstName && voter.voteSubmission.participantLastName && (
                                    <p className="text-xs text-muted-foreground">
                                      {voter.voteSubmission.participantFirstName} {voter.voteSubmission.participantLastName}
                                    </p>
                                  )}
                                  <p className="text-xs text-muted-foreground">
                                    Submitted: {formatDateTime(voter.voteSubmission.createdAt)}
                                  </p>
                                </div>
                                {voter.voteSubmission.thumbnailKey || voter.voteSubmission.key ? (
                                  <div className="rounded-lg overflow-hidden border bg-muted">
                                    <img
                                      src={getSubmissionImageUrl(
                                        voter.voteSubmission.thumbnailKey,
                                        voter.voteSubmission.key,
                                      )}
                                      alt={`Submission by ${voter.voteSubmission.participantReference || "Unknown"}`}
                                      className="w-full h-auto object-contain max-h-64"
                                    />
                                  </div>
                                ) : (
                                  <div className="rounded-lg border bg-muted h-32 flex items-center justify-center">
                                    <p className="text-xs text-muted-foreground">No image available</p>
                                  </div>
                                )}
                                {voter.voteSubmission.participantReference && (
                                  <Link
                                    href={`/admin/${domain}/dashboard/submissions/${voter.voteSubmission.participantReference}/${voter.voteSubmission.submissionId}`}
                                  >
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="w-full"
                                    >
                                      <ExternalLink className="mr-2 size-4" />
                                      View Submission
                                    </Button>
                                  </Link>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <span className="text-muted-foreground text-sm">Not voted</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7"
                            onClick={() => onCopyLink(voter.token)}
                          >
                            <Copy className="mr-1.5 size-3.5" />
                            Copy Link
                          </Button>

                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7"
                                disabled={isResending}
                              >
                                {pendingResendSessionId === voter.sessionId ? (
                                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                                ) : (
                                  <Send className="mr-1.5 size-3.5" />
                                )}
                                Resend
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-3" align="end">
                              <div className="space-y-3">
                                <div className="text-xs text-muted-foreground">
                                  Last sent: {formatDateTime(voter.notificationLastSentAt)}
                                </div>
                                <div className="space-y-2">
                                  <button
                                    className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                    disabled={!voter.phoneNumber}
                                    onClick={() => {
                                      // TODO: Implement SMS resend logic
                                    }}
                                  >
                                    <div className="flex items-center gap-2">
                                      <MessageSquare className="size-4" />
                                      <span className="text-sm font-medium">Send by SMS</span>
                                    </div>
                                  </button>
                                  <button
                                    className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                    disabled={!voter.email}
                                    onClick={() => {
                                      // TODO: Implement email resend logic
                                    }}
                                  >
                                    <div className="flex items-center gap-2">
                                      <Mail className="size-4" />
                                      <span className="text-sm font-medium">Send by Email</span>
                                    </div>
                                  </button>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                disabled={
                                  isClearingVote ||
                                  isDeletingSession ||
                                  pendingClearVoteSessionId === voter.sessionId ||
                                  pendingDeleteSessionId === voter.sessionId
                                }
                              >
                                {(pendingClearVoteSessionId === voter.sessionId ||
                                  pendingDeleteSessionId === voter.sessionId) ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <MoreVertical className="size-3.5" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => onClearVote(voter.sessionId)}
                                disabled={
                                  !voter.voteSubmission ||
                                  isClearingVote ||
                                  isDeletingSession ||
                                  pendingClearVoteSessionId === voter.sessionId ||
                                  pendingDeleteSessionId === voter.sessionId
                                }
                              >
                                <X className="size-4" />
                                Clear vote
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => onDeleteSession(voter.sessionId)}
                                disabled={
                                  isClearingVote ||
                                  isDeletingSession ||
                                  pendingClearVoteSessionId === voter.sessionId ||
                                  pendingDeleteSessionId === voter.sessionId
                                }
                              >
                                <Trash2 className="size-4" />
                                Delete session
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No voting sessions found for this topic.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {voters.length} of {total} voters
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onPreviousPage}
              disabled={isPageLoading || page <= 1}
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
              disabled={isPageLoading || pageCount === 0 || page >= pageCount}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
