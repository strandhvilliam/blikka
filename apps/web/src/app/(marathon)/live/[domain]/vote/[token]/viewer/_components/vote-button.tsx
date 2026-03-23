"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import { Heart } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { PrimaryButton } from "@/components/ui/primary-button"

interface VoteButtonProps {
  isSelected: boolean
  isEnabled: boolean
  hasVoted: boolean
  isOwnSubmission?: boolean
  onVote: () => void
  showComplete?: boolean
  className?: string
  submissionTitle?: string
  imageUrl?: string
}

export function VoteButton({
  isSelected,
  isEnabled,
  hasVoted,
  isOwnSubmission = false,
  onVote,
  className,
  submissionTitle,
  imageUrl,
}: VoteButtonProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const t = useTranslations("VotingViewerPage")
  const isDisabled = !isEnabled || isSelected || hasVoted || isOwnSubmission
  const buttonLabel = isOwnSubmission
    ? t("voteButton.cannotVoteForYourself")
    : isSelected
      ? t("voteButton.yourVote")
      : hasVoted
        ? t("voteButton.alreadyVoted")
        : t("voteButton.voteForThisPhoto")

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <PrimaryButton
          disabled={isDisabled}
          className={cn("w-full rounded-full py-4 text-base", className)}
        >
          <Heart className={cn("h-5 w-5 transition-all", isSelected && "fill-current")} />
          {buttonLabel}
        </PrimaryButton>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("voteButton.dialogTitle")}</AlertDialogTitle>
          {imageUrl && (
            <div className="max-h-32 overflow-hidden rounded-xl bg-muted aspect-video">
              <img
                src={imageUrl}
                alt={t("voteButton.imageAlt")}
                className="h-full w-full object-contain"
              />
            </div>
          )}
          <AlertDialogDescription>
            {t("voteButton.dialogDescription")}
            {submissionTitle && (
              <span className="mt-2 block">
                <span className="block text-xs text-muted-foreground">
                  {t("voteButton.topicLabel")}
                </span>
                <span className="block font-medium text-foreground">{submissionTitle}</span>
              </span>
            )}
            <span className="mt-2 block text-xs">{t("voteButton.cannotBeChanged")}</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("voteButton.cancel")}</AlertDialogCancel>
          <AlertDialogAction asChild>
            <PrimaryButton onClick={onVote}>{t("voteButton.confirm")}</PrimaryButton>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
