"use client"

import { useCallback, useState } from "react"
import { Archive, Download, Loader2 } from "lucide-react"
import { toast } from "sonner"

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
    <div
      className={cn(
        "group relative rounded-xl border bg-white transition-shadow duration-200",
        disabled
          ? "border-border/60 opacity-60 cursor-not-allowed"
          : "border-border hover:border-border/80 hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.04)]"
      )}
    >
      <div className="flex items-start gap-4 p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/80 text-muted-foreground/60">
          <Archive className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight text-foreground/70">
                Topic Images ZIP
              </h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed mt-0.5">
                Download a flat zip with all original images uploaded for the active topic.
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              ZIP
            </span>
          </div>
        </div>
      </div>

      <div className="mx-5 mb-5 pt-4 border-t border-border/50">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground/70">
            Files are downloaded directly from the active topic without per-participant folders.
          </p>
          <PrimaryButton
            onClick={handleDownload}
            disabled={isLoading || disabled}
            className="shrink-0 h-8 px-3 text-xs"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Exporting…
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                Download
              </>
            )}
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}
