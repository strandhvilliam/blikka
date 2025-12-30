"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import type { CompetitionClass, Submission, Topic } from "@blikka/db"
import { AlertTriangle, Download, Expand, ZoomIn, ZoomOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface SubmissionImageViewerProps {
  imageUrl: string | null
  topic: Topic
  submission: Submission
  competitionClass: CompetitionClass | null
}

export function SubmissionImageViewer({
  imageUrl,
  topic,
  submission,
  competitionClass,
}: SubmissionImageViewerProps) {
  const [hasError, setHasError] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [zoom, setZoom] = useState(1)

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3))
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5))
  const handleResetZoom = () => setZoom(1)

  return (
    <Card className="overflow-hidden bg-linear-to-br from-muted/30 to-muted/10">
      {/* Image Header Bar */}
      <div className="border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Badge variant="outline" className="font-mono text-xs h-6">
            #{topic.orderIndex + 1}
          </Badge>
          <div>
            <h2 className="font-semibold font-rocgrotesk text-base leading-tight">{topic.name}</h2>
            <p className="text-xs text-muted-foreground leading-tight">
              Topic {topic.orderIndex + 1} of {competitionClass?.numberOfPhotos || "?"}
            </p>
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
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            <Expand className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Image Display Area */}
      <div className="relative bg-muted/20 flex items-center justify-center min-h-[500px] max-h-[70vh] overflow-auto">
        {imageUrl && !hasError ? (
          <div
            className="transition-transform duration-200 ease-out p-8"
            style={{ transform: `scale(${zoom})` }}
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
            <Button variant="outline" className="mt-2">
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
                This submission doesn't have an associated image file.
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
