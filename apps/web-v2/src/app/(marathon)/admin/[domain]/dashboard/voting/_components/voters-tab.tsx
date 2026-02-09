import { Copy, Loader2, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { formatDateTime } from "./voting-utils"

interface Voter {
  sessionId: number
  firstName: string
  lastName: string
  email: string | null
  phoneNumber: string | null
  token: string
  notificationLastSentAt: string | null
  connectedParticipantId: number | null
}

interface VotersTabProps {
  voters: Voter[]
  page: number
  pageCount: number
  total: number
  isPageLoading: boolean
  onPreviousPage: () => void
  onNextPage: () => void
  onCopyToken: (token: string) => void
  onResendNotification: (sessionId: number) => void
  pendingResendSessionId: number | null
  isResending: boolean
}

export function VotersTab({
  voters,
  page,
  pageCount,
  total,
  isPageLoading,
  onPreviousPage,
  onNextPage,
  onCopyToken,
  onResendNotification,
  pendingResendSessionId,
  isResending,
}: VotersTabProps) {
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
                    Last Notification
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
                        {formatDateTime(voter.notificationLastSentAt)}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7"
                            onClick={() => onCopyToken(voter.token)}
                          >
                            <Copy className="mr-1.5 size-3.5" />
                            Copy Token
                          </Button>

                          {!voter.phoneNumber ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex">
                                  <Button variant="outline" size="sm" disabled>
                                    <Send className="mr-1.5 size-3.5" />
                                    Resend
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" sideOffset={8}>
                                Missing phone number for SMS resend
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7"
                              onClick={() =>
                                onResendNotification(voter.sessionId)
                              }
                              disabled={isResending}
                            >
                              {pendingResendSessionId === voter.sessionId ? (
                                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                              ) : (
                                <Send className="mr-1.5 size-3.5" />
                              )}
                              Resend
                            </Button>
                          )}
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
