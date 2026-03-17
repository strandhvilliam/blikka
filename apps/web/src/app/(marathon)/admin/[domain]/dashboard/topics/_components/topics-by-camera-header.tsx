"use client";

import { Camera, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PrimaryButton } from "@/components/ui/primary-button";

type TopicsByCameraHeaderProps = {
  onCreateClick: () => void;
  isLoading: boolean;
};

export function TopicsByCameraHeader({
  onCreateClick,
  isLoading,
}: TopicsByCameraHeaderProps) {
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h1 className="font-gothic text-3xl tracking-tight text-foreground lg:text-4xl">
            Topics
          </h1>
          <Badge
            variant="outline"
            className="h-6 gap-1.5 rounded-full px-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
          >
            <Camera className="size-3" />
            By camera
          </Badge>
        </div>
        <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
          Each event runs on a single active topic. Activate a topic first, then
          start or schedule submissions when you&apos;re ready to open uploads.
        </p>
      </div>
      <PrimaryButton
        onClick={onCreateClick}
        disabled={isLoading}
        className="shrink-0"
      >
        <Plus className="size-4" />
        New Topic
      </PrimaryButton>
    </div>
  );
}
