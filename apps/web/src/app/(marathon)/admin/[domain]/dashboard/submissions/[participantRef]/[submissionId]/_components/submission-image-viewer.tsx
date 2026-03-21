"use client"

import { useState } from "react"
import type { CompetitionClass, Topic } from "@blikka/db"
import { AlertTriangle, Download, Expand, ZoomIn, ZoomOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { downloadRemoteUrl } from "../_lib/download-remote-url"

interface SubmissionImageViewerProps {
  imageUrl: string | null
  /** Full-resolution object URL (submissions bucket). Used for expand + download. */
  originalImageUrl: string | null
  downloadFileName: string
  topic: Topic
  competitionClass: CompetitionClass | null
  marathonMode?: string
}

export function SubmissionImageViewer({
  imageUrl,
  originalImageUrl,
  downloadFileName,
  topic,
  competitionClass,
  marathonMode,
}: SubmissionImageViewerProps) {
  const [hasError, setHasError] = useState(false)
  const [largeViewOpen, setLargeViewOpen] = useState(false)
  const [zoom, setZoom] = useState(1)
  const isByCameraMode = marathonMode === "by-camera"

  const downloadSourceUrl = originalImageUrl ?? imageUrl
  const largeViewImageUrl = originalImageUrl ?? imageUrl

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3))
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5))
  const handleResetZoom = () => setZoom(1)

  const handleDownload = () => {
    if (!downloadSourceUrl) {
      return
    }
    void downloadRemoteUrl(downloadSourceUrl, downloadFileName)
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white">
      {/* Image Header Bar */}
      <div className="border-b border-border px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Badge variant="outline" className="font-mono text-xs h-6">
            #{topic.orderIndex + 1}
          </Badge>
          <div>
            <h2 className="font-gothic text-base font-normal leading-tight tracking-tight">{topic.name}</h2>
            {!isByCameraMode && (
              <p className="text-xs text-muted-foreground leading-tight">
                Topic {topic.orderIndex + 1} of {competitionClass?.numberOfPhotos || "?"}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleZoomOut}
            disabled={zoom <= 0.5}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-3 font-mono text-xs"
            onClick={handleResetZoom}
          >
            {Math.round(zoom * 100)}%
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleZoomIn}
            disabled={zoom >= 3}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <div className="w-px h-6 bg-border mx-1" />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={!downloadSourceUrl}
            onClick={handleDownload}
            aria-label="Download image"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={!largeViewImageUrl}
            onClick={() => setLargeViewOpen(true)}
            aria-label="View larger image"
          >
            <Expand className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={largeViewOpen} onOpenChange={setLargeViewOpen}>
        <DialogContent
          size="xl"
          showCloseButton
          className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[96vw]"
        >
          <DialogHeader className="shrink-0 space-y-1 border-b px-5 py-4 text-left">
            <DialogTitle className="font-gothic text-base font-normal tracking-tight">
              {topic.name}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Full-size submission image. Close the dialog to return to the review page.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto bg-muted/30 p-4">
            {largeViewImageUrl ? (
              <img
                src={largeViewImageUrl}
                alt=""
                className="mx-auto max-h-[calc(90dvh-7rem)] w-auto max-w-full object-contain shadow-lg"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Display Area */}
      <div className="relative bg-muted/20 flex items-center justify-center min-h-[500px] max-h-[70vh] overflow-auto">
        {imageUrl && !hasError ? (
          <div
            className="transition-transform duration-200 ease-out p-8"
            style={{ transform: `scale(${zoom + 0.5})` }}
          >
            <img
              src={imageUrl}
              alt={topic.name}
              className="max-w-full h-auto object-contain shadow-2xl"
              onError={() => setHasError(true)}
            />
          </div>
        ) : imageUrl && hasError ? (
          <div className="flex flex-col items-center justify-center gap-4 p-8 text-center max-w-md">
            <div className="p-4 rounded-full bg-orange-500/10">
              <AlertTriangle className="h-8 w-8 text-orange-500" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">Preview Not Available</h3>
              <p className="text-sm text-muted-foreground">
                Cannot preview this image. It may be corrupted or in a RAW format. Download the file
                to view it properly.
              </p>
            </div>
            <Button
              variant="outline"
              className="mt-2"
              disabled={!downloadSourceUrl}
              onClick={handleDownload}
            >
              <Download className="h-4 w-4 mr-2" />
              Download Original
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="p-4 rounded-full bg-muted">
              <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">Image Not Available</h3>
              <p className="text-sm text-muted-foreground">
                This submission doesn&apos;t have an associated image file.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
