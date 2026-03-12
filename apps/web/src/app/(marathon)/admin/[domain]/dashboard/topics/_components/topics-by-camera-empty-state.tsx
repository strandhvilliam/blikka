"use client";

import { Camera, Plus } from "lucide-react";
import { PrimaryButton } from "@/components/ui/primary-button";

type TopicsByCameraEmptyStateProps = {
  onCreateClick: () => void;
};

export function TopicsByCameraEmptyState({
  onCreateClick,
}: TopicsByCameraEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-20 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary/10">
        <Camera className="size-6 text-brand-primary" />
      </div>
      <h2 className="font-gothic text-xl tracking-tight text-foreground">
        No topics yet
      </h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Create your first topic to get started. Once active, participants can
        begin submitting their photos.
      </p>
      <PrimaryButton onClick={onCreateClick} className="mt-6">
        <Plus className="size-4" />
        Create your first topic
      </PrimaryButton>
    </div>
  );
}
