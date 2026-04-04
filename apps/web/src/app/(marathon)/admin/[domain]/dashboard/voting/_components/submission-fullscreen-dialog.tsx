"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getSubmissionFullImageUrl } from "../_lib/utils";

type SubmissionFullscreenDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participantDisplayName: string;
  submissionKey?: string | null;
};

export function SubmissionFullscreenDialog({
  open,
  onOpenChange,
  participantDisplayName,
  submissionKey,
}: SubmissionFullscreenDialogProps) {
  const imageUrl = getSubmissionFullImageUrl(submissionKey);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="full"
        className="flex max-h-[100dvh] items-center justify-center gap-0 border-0 bg-zinc-950 p-2 shadow-none sm:p-3 [&_[data-slot=dialog-close]]:text-white [&_[data-slot=dialog-close]]:hover:bg-white/10 [&_[data-slot=dialog-close]]:hover:text-white"
      >
        <DialogTitle className="sr-only">
          {participantDisplayName} — submission photo
        </DialogTitle>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`Submission by ${participantDisplayName}`}
            className="max-h-[calc(100dvh-1rem)] max-w-full object-contain"
          />
        ) : (
          <p className="text-sm text-zinc-400">No full-size photo available</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
