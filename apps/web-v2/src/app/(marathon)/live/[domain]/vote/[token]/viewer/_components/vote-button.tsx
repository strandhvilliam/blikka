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

interface VoteButtonProps {
  isSelected: boolean;
  isEnabled: boolean;
  onVote: () => void;
  showComplete?: boolean;
  className?: string;
  submissionTitle?: string;
}

export function VoteButton({
  isSelected,
  isEnabled,
  onVote,
  className,
  submissionTitle,
}: VoteButtonProps) {
  const [isOpen, setIsOpen] = React.useState(false);


  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <button
          disabled={!isEnabled}
          className={cn(
            "w-full py-4 rounded-2xl font-medium text-base transition-all",
            isSelected
              ? "bg-foreground text-background shadow-lg"
              : "bg-muted text-foreground hover:bg-muted/80",
            !isEnabled && "opacity-50 cursor-not-allowed",
            "active:scale-[0.98]",
            className,
          )}
        >
          <span className="flex items-center justify-center gap-2">
            <Heart
              className={cn(
                "w-5 h-5 transition-all",
                isSelected && "fill-current",
              )}
            />
            {isSelected ? "Your Vote" : "Vote for this"}
          </span>
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Your Vote</AlertDialogTitle>
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
          <AlertDialogAction onClick={onVote}>Confirm Vote</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
