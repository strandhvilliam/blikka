"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  CompetitionClass,
  DeviceGroup,
  Participant,
  Submission,
  Topic,
  ValidationResult,
} from "@blikka/db";
import { format } from "date-fns";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  Image,
  Info,
  Smartphone,
  Upload,
  XCircle,
  Trophy,
  Vote,
  CheckCircle,
  Clock3,
  Link2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { formatDomainPathname } from "@/lib/utils";
import { useDomain } from "@/lib/domain-provider";

interface VoteStats {
  voteCount: number;
  position: number;
  totalSubmissions: number;
  participantVoteInfo: {
    hasVoted: boolean;
    votedAt: string | null;
    votedSubmissionId: number | null;
    votedTopicName: string | null;
  } | null;
}

interface SubmissionMetadataPanelProps {
  submission: Submission;
  topic: Topic;
  participant: Participant & {
    competitionClass: CompetitionClass | null;
    deviceGroup: DeviceGroup | null;
  };
  hasIssues: boolean;
  validationResults: ValidationResult[];
  marathonMode?: string;
  voteStats?: VoteStats;
}

export function SubmissionMetadataPanel({
  submission,
  topic,
  participant,
  hasIssues,
  validationResults,
  marathonMode,
  voteStats,
}: SubmissionMetadataPanelProps) {
  const domain = useDomain();
  const isByCameraMode = marathonMode === "by-camera";

  return (
    <div className="space-y-4">

      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Submission Info
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4 px-4 pt-2">
          <div className="space-y-2.5">
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <Upload className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground leading-tight">
                  Upload Time
                </p>
                <p className="text-sm font-medium leading-tight mt-0.5">
                  {format(new Date(submission.createdAt), "MMM d, yyyy")}
                </p>
                <p className="text-xs text-muted-foreground leading-tight">
                  {format(new Date(submission.createdAt), "HH:mm:ss")}
                </p>
              </div>
            </div>

            <Separator className="my-2" />

            <div className="flex items-start gap-2.5">
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600">
                {participant.deviceGroup?.icon === "smartphone" ? (
                  <Smartphone className="h-3.5 w-3.5" />
                ) : (
                  <Camera className="h-3.5 w-3.5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground leading-tight">
                  Device Type
                </p>
                <p className="text-sm font-medium leading-tight mt-0.5">
                  {participant.deviceGroup?.name || "Not specified"}
                </p>
                {participant.deviceGroup?.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-tight mt-0.5">
                    {participant.deviceGroup.description}
                  </p>
                )}
              </div>
            </div>

            {!isByCameraMode && (
              <>
                <Separator className="my-2" />

                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center min-w-[28px]">
                    {participant.competitionClass?.numberOfPhotos !==
                      undefined ? (
                      <span className="text-xs font-semibold">
                        {participant.competitionClass.numberOfPhotos}
                      </span>
                    ) : (
                      <Image className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground leading-tight">
                      Competition Class
                    </p>
                    <p className="text-sm font-medium leading-tight mt-0.5">
                      {participant.competitionClass?.name || "Not assigned"}
                    </p>
                    {participant.competitionClass?.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-tight mt-0.5">
                        {participant.competitionClass.description}
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Voting Results - Only for by-camera mode */}
      {isByCameraMode && voteStats && (
        <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/10">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5" />
              Voting Results
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4 pt-2">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                  #{voteStats.position}
                </p>
                <p className="text-xs text-muted-foreground">
                  of {voteStats.totalSubmissions} submissions
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                  {voteStats.voteCount}
                </p>
                <p className="text-xs text-muted-foreground">total votes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Participant's Vote Info - Only for by-camera mode */}
      {isByCameraMode && voteStats?.participantVoteInfo && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Vote className="h-3.5 w-3.5" />
              Participant&apos;s Vote
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4 pt-2">
            {voteStats.participantVoteInfo.hasVoted ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Has voted</span>
                </div>
                {voteStats.participantVoteInfo.votedAt && (
                  <p className="text-xs text-muted-foreground">
                    Voted on{" "}
                    {format(
                      new Date(voteStats.participantVoteInfo.votedAt),
                      "MMM d, yyyy HH:mm",
                    )}
                  </p>
                )}
                {voteStats.participantVoteInfo.votedTopicName && (
                  <div className="p-2.5 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">
                      Voted for:
                    </p>
                    <p className="text-sm font-medium">
                      {voteStats.participantVoteInfo.votedTopicName}
                    </p>
                  </div>
                )}
                {voteStats.participantVoteInfo.votedSubmissionId &&
                  voteStats.participantVoteInfo.votedSubmissionId !==
                  submission.id && (
                    <Link
                      href={formatDomainPathname(
                        `/admin/dashboard/submissions/${participant.reference}/${voteStats.participantVoteInfo.votedSubmissionId}`,
                        domain,
                      )}
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <Link2 className="h-3 w-3" />
                      View their choice
                    </Link>
                  )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock3 className="h-4 w-4" />
                <span className="text-sm">Not voted yet</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Validation Summary */}
      {validationResults.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Validation Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4 pt-2">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-green-500/10 border border-green-200">
                <div className="text-xl font-bold text-green-600">
                  {
                    validationResults.filter((r) => r.outcome === "passed")
                      .length
                  }
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Passed
                </div>
              </div>
              <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-200">
                <div className="text-xl font-bold text-yellow-600">
                  {
                    validationResults.filter(
                      (r) => r.severity === "warning" && r.outcome === "failed",
                    ).length
                  }
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Warnings
                </div>
              </div>
              <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                <div className="text-xl font-bold text-destructive">
                  {
                    validationResults.filter(
                      (r) => r.severity === "error" && r.outcome === "failed",
                    ).length
                  }
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Errors
                </div>
              </div>
            </div>

            {hasIssues && (
              <div className="p-2.5 rounded-lg bg-orange-500/10 border border-orange-200 mt-2.5">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-orange-600 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-orange-900 dark:text-orange-100 leading-tight">
                      Action Required
                    </p>
                    <p className="text-xs text-orange-700 dark:text-orange-200 mt-0.5 leading-tight">
                      This submission has validation issues that need attention.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* File Information */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            File Details
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4 px-4 pt-2 space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground text-xs">File Key</span>
            <span
              className="font-mono text-xs truncate max-w-[200px]"
              title={submission.key || "N/A"}
            >
              {submission.key ? `...${submission.key.slice(-20)}` : "N/A"}
            </span>
          </div>
          <Separator className="my-1.5" />
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground text-xs">Thumbnail</span>
            <span className="text-xs">
              {submission.thumbnailKey ? (
                <Badge
                  variant="outline"
                  className="bg-green-500/10 text-green-600 border-green-200 h-5"
                >
                  Available
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="bg-red-500/10 text-red-600 border-red-200 h-5"
                >
                  Missing
                </Badge>
              )}
            </span>
          </div>
          <Separator className="my-1.5" />
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground text-xs">EXIF Data</span>
            <span className="text-xs">
              {submission.exif && Object.keys(submission.exif).length > 0 ? (
                <Badge
                  variant="outline"
                  className="bg-green-500/10 text-green-600 border-green-200 h-5"
                >
                  {Object.keys(submission.exif).length} fields
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="bg-red-500/10 text-red-600 border-red-200 h-5"
                >
                  Not available
                </Badge>
              )}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
