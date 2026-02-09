import { Vote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";

interface VotingHeaderProps {
  topicName: string;
  topicOrderIndex: number;
  hasSessions: boolean;
  isOverviewLoading: boolean;
  onOpenInviteDialog: () => void;
}

export function VotingHeader({
  topicName,
  topicOrderIndex,
  hasSessions,
  isOverviewLoading,
  onOpenInviteDialog,
}: VotingHeaderProps) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight font-rocgrotesk">
              Voting
            </h1>
            <Badge variant="secondary">
              <Vote className="mr-1 h-3 w-3" />
              Topic {topicOrderIndex + 1}
            </Badge>
            <Badge variant="outline">By Camera</Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            Manage voting sessions and rankings for{" "}
            <span className="font-medium text-foreground">{topicName}</span>.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={onOpenInviteDialog}
            disabled={!hasSessions || isOverviewLoading}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Invite Manual Voter
          </Button>
        </div>
      </div>
    </section>
  );
}
