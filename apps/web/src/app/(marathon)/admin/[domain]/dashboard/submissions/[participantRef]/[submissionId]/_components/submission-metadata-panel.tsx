"use client"

import type {
  CompetitionClass,
  DeviceGroup,
  Participant,
  Submission,
  Topic,
  ValidationResult,
} from "@blikka/db"
import { format } from "date-fns"
import {
  AlertTriangle,
  Camera,
  Image as ImageIcon,
  Smartphone,
  Upload,
  Trophy,
  Vote,
  CheckCircle,
  Clock3,
  Link2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { formatDomainPathname } from "@/lib/utils"
import { getVotingLifecycleState } from "@/lib/voting-lifecycle"

interface VoteStats {
  voteCount: number
  position: number | null
  totalSubmissions: number
  roundNumber?: number | null
  roundKind?: string | null
  participantVoteInfo: {
    hasVoted: boolean
    votedAt: string | null
    votedSubmissionId: number | null
    votedTopicName: string | null
  } | null
}

interface SubmissionMetadataPanelProps {
  submission: Submission
  submissionTopic: Pick<Topic, "votingStartsAt" | "votingEndsAt"> | null
  participant: Participant & {
    competitionClass: CompetitionClass | null
    deviceGroup: DeviceGroup | null
  }
  hasIssues: boolean
  validationResults: ValidationResult[]
  marathonMode?: string
  voteStats?: VoteStats
  domain: string
}

function PanelCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border border-border bg-white", className)}>{children}</div>
}

function PanelHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="pb-2 pt-4 px-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
        {children}
      </h3>
    </div>
  )
}

function PanelHeaderWithIcon({
  icon,
  children,
  className,
}: {
  icon: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className="pb-2 pt-4 px-4">
      <h3
        className={cn(
          "text-[11px] font-semibold uppercase tracking-widest flex items-center gap-1.5",
          className ?? "text-muted-foreground/70",
        )}
      >
        {icon}
        {children}
      </h3>
    </div>
  )
}

export function SubmissionMetadataPanel({
  submission,
  submissionTopic,
  participant,
  hasIssues,
  validationResults,
  marathonMode,
  voteStats,
  domain,
}: SubmissionMetadataPanelProps) {
  const isByCameraMode = marathonMode === "by-camera"
  const byCameraVotingRelevant =
    isByCameraMode &&
    submissionTopic &&
    getVotingLifecycleState({
      startsAt: submissionTopic.votingStartsAt,
      endsAt: submissionTopic.votingEndsAt,
    }) !== "not-started"

  return (
    <div className="space-y-4">
      <PanelCard>
        <PanelHeader>Submission Info</PanelHeader>
        <div className="pb-4 px-4 pt-2">
          <div className="space-y-2.5">
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 rounded-lg bg-brand-primary/10 text-brand-primary">
                <Upload className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-muted-foreground leading-tight">
                  Upload Time
                </p>
                <p className="text-sm font-medium leading-tight mt-0.5">
                  {format(new Date(submission.createdAt), "MMM d, yyyy")}
                </p>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  {format(new Date(submission.createdAt), "HH:mm:ss")}
                </p>
              </div>
            </div>

            <div className="border-t border-border my-2" />

            <div className="flex items-start gap-2.5">
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600">
                {participant.deviceGroup?.icon === "smartphone" ? (
                  <Smartphone className="h-3.5 w-3.5" />
                ) : (
                  <Camera className="h-3.5 w-3.5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-muted-foreground leading-tight">
                  Device Type
                </p>
                <p className="text-sm font-medium leading-tight mt-0.5">
                  {participant.deviceGroup?.name || "Not specified"}
                </p>
                {participant.deviceGroup?.description && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2 leading-tight mt-0.5">
                    {participant.deviceGroup.description}
                  </p>
                )}
              </div>
            </div>

            {!isByCameraMode && (
              <>
                <div className="border-t border-border my-2" />

                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center min-w-[28px]">
                    {participant.competitionClass?.numberOfPhotos !== undefined ? (
                      <span className="text-xs font-semibold">
                        {participant.competitionClass.numberOfPhotos}
                      </span>
                    ) : (
                      <ImageIcon className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-muted-foreground leading-tight">
                      Competition Class
                    </p>
                    <p className="text-sm font-medium leading-tight mt-0.5">
                      {participant.competitionClass?.name || "Not assigned"}
                    </p>
                    {participant.competitionClass?.description && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2 leading-tight mt-0.5">
                        {participant.competitionClass.description}
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </PanelCard>

      {byCameraVotingRelevant && voteStats && (
        <PanelCard className="border-amber-200 bg-amber-50/30">
          <PanelHeaderWithIcon icon={<Trophy className="h-3.5 w-3.5" />} className="text-amber-700">
            Voting Results
          </PanelHeaderWithIcon>
          <div className="pb-4 px-4 pt-2">
            <div className="flex items-center justify-between mb-3">
              <div>
                {voteStats.position != null ? (
                  <>
                    <p className="text-2xl font-bold text-amber-700">#{voteStats.position}</p>
                    <p className="text-[11px] text-muted-foreground">
                      of {voteStats.totalSubmissions} submissions
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground leading-snug">
                    Not ranked in the current voting round (e.g. tie-break shortlist).
                  </p>
                )}
                {voteStats.roundNumber ? (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {voteStats.roundKind === "tiebreak"
                      ? `Tie-break ${voteStats.roundNumber}`
                      : `Round ${voteStats.roundNumber}`}
                  </p>
                ) : null}
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-amber-700">{voteStats.voteCount}</p>
                <p className="text-[11px] text-muted-foreground">total votes</p>
              </div>
            </div>
          </div>
        </PanelCard>
      )}

      {byCameraVotingRelevant && (
        <PanelCard>
          <PanelHeaderWithIcon icon={<Vote className="h-3.5 w-3.5" />}>
            Participant&apos;s Vote
          </PanelHeaderWithIcon>
          <div className="pb-4 px-4 pt-2">
            {voteStats?.participantVoteInfo?.hasVoted ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium">Has voted</span>
                </div>
                {voteStats.participantVoteInfo.votedAt && (
                  <p className="text-[11px] text-muted-foreground">
                    Voted on{" "}
                    {format(new Date(voteStats.participantVoteInfo.votedAt), "MMM d, yyyy HH:mm")}
                  </p>
                )}
                {voteStats.participantVoteInfo.votedTopicName && (
                  <div className="p-2.5 rounded-lg bg-muted/30">
                    <p className="text-[11px] text-muted-foreground mb-1">Voted for:</p>
                    <p className="text-sm font-medium">
                      {voteStats.participantVoteInfo.votedTopicName}
                    </p>
                  </div>
                )}
                {voteStats.participantVoteInfo.votedSubmissionId &&
                  voteStats.participantVoteInfo.votedSubmissionId !== submission.id && (
                    <Link
                      href={formatDomainPathname(
                        `/admin/dashboard/submissions/${participant.reference}/${voteStats.participantVoteInfo.votedSubmissionId}`,
                        domain,
                      )}
                      className="inline-flex items-center gap-1.5 text-[11px] text-brand-primary hover:underline"
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
          </div>
        </PanelCard>
      )}

      {validationResults.length > 0 && (
        <PanelCard>
          <PanelHeader>Validation Summary</PanelHeader>
          <div className="pb-4 px-4 pt-2">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-green-500/10 border border-green-200">
                <div className="text-xl font-bold text-green-600">
                  {validationResults.filter((r) => r.outcome === "passed").length}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Passed</div>
              </div>
              <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-200">
                <div className="text-xl font-bold text-yellow-600">
                  {
                    validationResults.filter(
                      (r) => r.severity === "warning" && r.outcome === "failed",
                    ).length
                  }
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Warnings</div>
              </div>
              <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                <div className="text-xl font-bold text-destructive">
                  {
                    validationResults.filter(
                      (r) => r.severity === "error" && r.outcome === "failed",
                    ).length
                  }
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Errors</div>
              </div>
            </div>

            {hasIssues && (
              <div className="p-2.5 rounded-lg bg-orange-500/10 border border-orange-200 mt-2.5">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-orange-600 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-orange-900 leading-tight">
                      Action Required
                    </p>
                    <p className="text-[11px] text-orange-700 mt-0.5 leading-tight">
                      This submission has validation issues that need attention.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </PanelCard>
      )}

      <PanelCard>
        <PanelHeader>File Details</PanelHeader>
        <div className="pb-4 px-4 pt-2 space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground text-[11px]">File Key</span>
            <span
              className="font-mono text-[11px] truncate max-w-[200px]"
              title={submission.key || "N/A"}
            >
              {submission.key ? `...${submission.key.slice(-20)}` : "N/A"}
            </span>
          </div>
          <div className="border-t border-border my-1.5" />
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground text-[11px]">Thumbnail</span>
            <span className="text-[11px]">
              {submission.thumbnailKey ? (
                <Badge
                  variant="outline"
                  className="bg-green-500/10 text-green-600 border-green-200 h-5 text-[10px]"
                >
                  Available
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="bg-red-500/10 text-red-600 border-red-200 h-5 text-[10px]"
                >
                  Missing
                </Badge>
              )}
            </span>
          </div>
          <div className="border-t border-border my-1.5" />
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground text-[11px]">EXIF Data</span>
            <span className="text-[11px]">
              {submission.exif && Object.keys(submission.exif).length > 0 ? (
                <Badge
                  variant="outline"
                  className="bg-green-500/10 text-green-600 border-green-200 h-5 text-[10px]"
                >
                  {Object.keys(submission.exif).length} fields
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="bg-red-500/10 text-red-600 border-red-200 h-5 text-[10px]"
                >
                  Not available
                </Badge>
              )}
            </span>
          </div>
        </div>
      </PanelCard>
    </div>
  )
}
