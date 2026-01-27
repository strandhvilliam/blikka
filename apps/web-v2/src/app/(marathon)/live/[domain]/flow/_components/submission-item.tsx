"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Topic } from "@blikka/db";
import { ImageIcon, Plus, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { SelectedPhoto } from "../_lib/types";

interface SubmissionItemProps {
  photo?: SelectedPhoto;
  topic?: Topic;
  index: number;
  onRemove?: (orderIndex: number) => void;
  onUploadClick?: () => void;
}

export function SubmissionItem({
  photo,
  topic,
  index,
  onRemove,
  onUploadClick,
}: SubmissionItemProps) {
  const t = useTranslations("FlowPage.uploadStep");

  if (!photo) {
    // Empty slot
    return (
      <Card
        className={cn(
          "flex items-center gap-4 p-4 border-dashed border-2 cursor-pointer",
          "hover:border-primary/50 hover:bg-muted/50 transition-colors",
        )}
        onClick={onUploadClick}
      >
        <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center shrink-0">
          <Plus className="w-6 h-6 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">
            {topic?.name || t("photo", { number: index + 1 })}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("tapToSelect")}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex items-center gap-4 p-4">
      <div className="w-16 h-16 rounded-md overflow-hidden bg-muted shrink-0 relative">
        {photo.preview ? (
          <Image
            src={photo.preview}
            alt={photo.file.name}
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-6 h-6 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">
          {topic?.name || t("photo", { number: index + 1 })}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {photo.file.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {(photo.file.size / 1024 / 1024).toFixed(2)} MB
        </p>
      </div>
      {onRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => onRemove(photo.orderIndex)}
        >
          <X className="w-4 h-4" />
          <span className="sr-only">{t("remove")}</span>
        </Button>
      )}
    </Card>
  );
}
