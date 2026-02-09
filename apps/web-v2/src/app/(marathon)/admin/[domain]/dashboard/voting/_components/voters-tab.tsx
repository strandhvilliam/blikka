import { Copy, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDateTime } from "./voting-utils";

interface Voter {
  sessionId: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phoneNumber: string | null;
  token: string;
  notificationLastSentAt: string | null;
  connectedParticipantId: number | null;
}

interface VotersTabProps {
  voters: Voter[];
  onCopyToken: (token: string) => void;
  onResendNotification: (sessionId: number) => void;
  pendingResendSessionId: number | null;
  isResending: boolean;
}

export function VotersTab({
  voters,
  onCopyToken,
  onResendNotification,
  pendingResendSessionId,
  isResending,
}: VotersTabProps) {
  return (
    <Card className="shadow-sm py-4">
      <CardHeader>
        <CardTitle className="font-rocgrotesk">Voting Sessions</CardTitle>
        <CardDescription>
          All voters for this topic, including manual invites and participant
          sessions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Voter</TableHead>
                <TableHead>Token</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Last Notification</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {voters.length ? (
                voters.map((voter) => (
                  <TableRow key={voter.sessionId}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">
                          {voter.firstName} {voter.lastName}
                        </p>
                        <Badge variant="outline">
                          {voter.connectedParticipantId
                            ? "Participant"
                            : "Manual"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="font-mono text-xs">{voter.token}</code>
                    </TableCell>
                    <TableCell>{voter.email || "-"}</TableCell>
                    <TableCell>{voter.phoneNumber || "-"}</TableCell>
                    <TableCell>
                      {formatDateTime(voter.notificationLastSentAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onCopyToken(voter.token)}
                        >
                          <Copy className="mr-1.5 h-3.5 w-3.5" />
                          Copy Token
                        </Button>

                        {!voter.phoneNumber ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex">
                                <Button variant="outline" size="sm" disabled>
                                  <Send className="mr-1.5 h-3.5 w-3.5" />
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
                            onClick={() =>
                              onResendNotification(voter.sessionId)
                            }
                            disabled={isResending}
                          >
                            {pendingResendSessionId === voter.sessionId ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Send className="mr-1.5 h-3.5 w-3.5" />
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
      </CardContent>
    </Card>
  );
}
