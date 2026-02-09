import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface VotingProgressProps {
  totalSessions: number;
  completedSessions: number;
  pendingSessions: number;
  completionRate: number;
}

export function VotingProgress({
  totalSessions,
  completedSessions,
  pendingSessions,
  completionRate,
}: VotingProgressProps) {
  return (
    <Card className="shadow-sm">
      <CardContent className="space-y-4 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Voting progress</p>
            <p className="text-xs text-muted-foreground">
              {completedSessions} of {totalSessions} sessions completed
            </p>
          </div>
          <Badge variant={pendingSessions > 0 ? "outline" : "secondary"}>
            {pendingSessions > 0
              ? `${pendingSessions} pending`
              : "All sessions completed"}
          </Badge>
        </div>

        <div className="space-y-1.5">
          <Progress value={completionRate} className="h-1.5" />
          <p className="text-xs font-medium text-muted-foreground">
            {completionRate}% completion
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
