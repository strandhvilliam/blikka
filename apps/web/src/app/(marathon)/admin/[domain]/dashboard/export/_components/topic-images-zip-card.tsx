"use client"

import { useCallback, useState } from "react"
import { Archive, Download, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { useDomain } from "@/lib/domain-provider"
import { cn } from "@/lib/utils"
import { PrimaryButton } from "@/components/ui/primary-button"

import { downloadFile } from "../_lib/download-file"
import { sanitizeFilenameSegment } from "../_lib/sanitize-filename-segment"

interface TopicImagesZipCardProps {
  disabled?: boolean
  topicName: string | null
}

export function TopicImagesZipCard({
  disabled = false,
  topicName,
}: TopicImagesZipCardProps) {
  const domain = useDomain()
  const [isLoading, setIsLoading] = useState(false)

  const handleDownload = useCallback(async () => {
    try {
      setIsLoading(true)

      const topicSlug = sanitizeFilenameSegment(topicName)
      const filename = `${topicSlug}-images-${new Date().toISOString().split("T")[0]}.zip`

      await downloadFile(`/api/${domain}/export/by_camera_topic_images`, filename)

      toast.success("ZIP export ready", {
        description: "The topic image archive has been downloaded.",
      })
    } catch {
      toast.error("ZIP export failed", {
        description: "There was an error preparing the topic image archive.",
      })
    } finally {
      setIsLoading(false)
    }
  }, [domain, topicName])

  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all duration-200 py-6!",
        disabled ? "opacity-50 cursor-not-allowed" : "hover:shadow-md",
      )}
    >
      <CardHeader className="space-y-0 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                "ring-1 ring-border text-muted-foreground",
              )}
              style={{ background: "rgba(139, 92, 246, 0.12)" }}
            >
              <Archive className="h-5 w-5 text-violet-600" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold font-gothic leading-none">Topic Images ZIP</h3>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                Download a flat zip with all original images uploaded for the active topic.
              </p>
            </div>
          </div>

          <Badge variant="secondary" className="rounded-full">
            ZIP
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Files are downloaded directly from the active topic without per-participant folders.
          </p>
          <PrimaryButton
            onClick={handleDownload}
            disabled={isLoading || disabled}
            className="w-full sm:w-auto h-9 px-3 py-1.5"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Download
              </>
            )}
          </PrimaryButton>
        </div>
      </CardContent>
    </Card>
  )
}
