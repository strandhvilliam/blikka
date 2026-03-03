"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Heart } from "lucide-react";
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
} from "@/components/ui/alert-dialog";
import { PrimaryButton } from "@/components/ui/primary-button";

interface VoteButtonProps {
  isSelected: boolean;
  isEnabled: boolean;
  hasVoted: boolean;
  onVote: () => void;
  showComplete?: boolean;
  className?: string;
  submissionTitle?: string;
  imageUrl?: string;
}

export function VoteButton({
  isSelected,
  isEnabled,
  hasVoted,
  onVote,
  className,
  submissionTitle,
  imageUrl,
}: VoteButtonProps) {
  const [isOpen, setIsOpen] = React.useState(false);


  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <PrimaryButton
          disabled={!isEnabled || isSelected || hasVoted}
          className={cn("w-full py-4 rounded-2xl text-base", className)}
        >
          <Heart
            className={cn(
              "w-5 h-5 transition-all",
              isSelected && "fill-current",
            )}
          />
          {isSelected ? "Your Vote" : hasVoted ? "Already voted" : "Cast your vote!"}
        </PrimaryButton>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Your Vote</AlertDialogTitle>
          {imageUrl && (
            <div className="rounded-lg overflow-hidden bg-muted aspect-video max-h-32">
              <img
                src={imageUrl}
                alt="Submission"
                className="w-full h-full object-contain"
              />
            </div>
          )}
          <AlertDialogDescription>
            Are you sure you want to vote for this submission?
            {submissionTitle && (
              <span className="block mt-2 font-medium text-foreground">
                {submissionTitle}
              </span>
            )}
            <span className="block mt-2 text-xs">
              This action cannot be undone.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction asChild>
            <PrimaryButton onClick={onVote}>Confirm Vote</PrimaryButton>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
