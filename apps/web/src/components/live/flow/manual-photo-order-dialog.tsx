"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { useTranslations } from "next-intl"
import type { Topic } from "@blikka/db"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PrimaryButton } from "@/components/ui/primary-button"
import { getCapturedAtDate } from "@/lib/exif-parsing"
import { cn } from "@/lib/utils"

import { moveItemInArray } from "@/lib/flow/photo-ordering"
import type { SelectedPhoto } from "@/lib/flow/types"

interface ManualPhotoOrderDialogProps {
  open: boolean
  photos: SelectedPhoto[]
  topics: Topic[]
  onClose: () => void
  onContinue: (photos: SelectedPhoto[]) => void
}

export function ManualPhotoOrderDialog({
  open,
  photos,
  topics,
  onClose,
  onContinue,
}: ManualPhotoOrderDialogProps) {
  const t = useTranslations("FlowPage.uploadStep")
  const [draftPhotos, setDraftPhotos] = useState(photos)

  useEffect(() => {
    if (open) {
      setDraftPhotos(photos)
    }
  }, [open, photos])

  const orderedTopics = useMemo(
    () => [...topics].sort((a, b) => a.orderIndex - b.orderIndex),
    [topics],
  )

  const handleMove = (index: number, direction: "up" | "down") => {
    setDraftPhotos((current) => moveItemInArray(current, index, direction))
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[85dvh] max-w-md flex-col gap-0 overflow-hidden border-2 border-border bg-white p-0"
      >
        <DialogHeader className="shrink-0 px-5 pt-5 pb-3 text-left">
          <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
            {t("manualOrderTitle")}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {t("manualOrderDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
          <div className="flex flex-col gap-2">
            {draftPhotos.map((photo, index) => {
              const capturedAt = getCapturedAtDate(photo.exif)
              const topic = orderedTopics[index]
              const isFirst = index === 0
              const isLast = index === draftPhotos.length - 1

              return (
                <div
                  key={photo.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-white p-2"
                >
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted/30">
                    <img
                      src={photo.preview}
                      alt={t("uploadPreviewAlt", { index: index + 1 })}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      <span className="text-muted-foreground">#{index + 1}</span>{" "}
                      {topic?.name ?? t("topicLabel")}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs">
                      <span
                        className={cn(
                          "shrink-0",
                          capturedAt ? "text-emerald-600" : "text-amber-600",
                        )}
                      >
                        {capturedAt
                          ? capturedAt.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            })
                          : t("noCaptureTime")}
                      </span>
                      <span className="truncate text-muted-foreground/60">{photo.file.name}</span>
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col">
                    <button
                      type="button"
                      aria-label={t("movePhotoUp", { index: index + 1 })}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-25"
                      disabled={isFirst}
                      onClick={() => handleMove(index, "up")}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={t("movePhotoDown", { index: index + 1 })}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-25"
                      disabled={isLast}
                      onClick={() => handleMove(index, "down")}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex shrink-0 gap-3 border-t border-border px-4 py-4">
          <Button
            type="button"
            variant="outline"
            className="h-12 flex-1 rounded-full"
            onClick={onClose}
          >
            {t("cancel")}
          </Button>
          <PrimaryButton
            type="button"
            className="h-12 flex-1 rounded-full text-base font-medium"
            onClick={() => onContinue(draftPhotos)}
          >
            {t("continueAfterManualOrder")}
          </PrimaryButton>
        </div>
      </DialogContent>
    </Dialog>
  )
}
