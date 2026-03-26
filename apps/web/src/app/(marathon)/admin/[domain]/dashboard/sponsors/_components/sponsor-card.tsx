"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Upload, Replace, ImageIcon, Clock, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import type { Sponsor } from "@blikka/db"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

type SponsorType = "contact-sheets" | "live-landing" | "live-success-1" | "live-success-2"

interface SponsorCardProps {
  title: string
  description: string
  type: SponsorType
  icon: LucideIcon
  disabled?: boolean
  sponsor?: Sponsor | null
}

export function SponsorCard({
  title,
  description,
  type,
  icon: Icon,
  disabled = false,
  sponsor,
}: SponsorCardProps) {
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const domain = useDomain()

  const { mutateAsync: generateUploadUrl } = useMutation(
    trpc.sponsors.generateUploadUrl.mutationOptions()
  )

  const { mutate: createSponsor } = useMutation(
    trpc.sponsors.create.mutationOptions({
      onSuccess: () => {
        toast.success("Sponsor image uploaded successfully")
        queryClient.invalidateQueries({
          queryKey: trpc.sponsors.pathKey(),
        })
        setUploading(false)
      },
      onError: (error) => {
        toast.error(error.message || "Failed to create sponsor")
        setUploading(false)
      },
    })
  )

  const handleFileUpload = async (file: File) => {
    try {
      setUploading(true)

      const { url, key } = await generateUploadUrl({
        domain,
        type,
        position: "bottom-right",
      })

      const response = await fetch(url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      })

      if (!response.ok) {
        throw new Error("Failed to upload file")
      }

      createSponsor({
        domain,
        type,
        key,
        position: "bottom-right",
      })
    } catch (error) {
      console.error("Upload failed:", error)
      toast.error("Failed to upload sponsor image")
      setUploading(false)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) handleFileUpload(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (disabled || uploading) return
    const file = e.dataTransfer.files[0]
    if (file?.type.startsWith("image/")) handleFileUpload(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled && !uploading) setDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
  }

  const triggerFileSelect = () => inputRef.current?.click()

  const imageUrl = sponsor
    ? `https://s3.eu-north-1.amazonaws.com/${process.env.NEXT_PUBLIC_MARATHON_SETTINGS_BUCKET_NAME}/${sponsor.key}`
    : null

  const hasImage = !!imageUrl

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-white transition-shadow duration-200",
        disabled
          ? "border-border/60 opacity-60"
          : hasImage
            ? "border-brand-primary/20 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)]"
            : "border-border hover:border-border/80 hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.04)]",
        dragging && !disabled && "border-brand-primary/40 shadow-[0_2px_16px_-2px_rgba(0,0,0,0.08)]"
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      <div className="flex flex-col sm:flex-row sm:items-stretch">
        <div className="flex min-w-0 flex-1 items-start gap-4 p-5">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors duration-200",
              hasImage && !disabled
                ? "bg-brand-primary/10 text-brand-primary"
                : "bg-muted/80 text-muted-foreground/60"
            )}
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </div>

          <div className="flex min-w-0 max-w-lg flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3
                  className={cn(
                    "text-[15px] font-semibold tracking-tight transition-colors duration-200",
                    hasImage && !disabled ? "text-foreground" : "text-foreground/70"
                  )}
                >
                  {title}
                </h3>
                <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </div>

              {disabled ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Coming soon
                </span>
              ) : null}
            </div>

            {!disabled ? (
              <Button
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={triggerFileSelect}
                className="w-fit text-xs"
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Uploading…
                  </>
                ) : hasImage ? (
                  <>
                    <Replace className="mr-1.5 h-3.5 w-3.5" />
                    Replace image
                  </>
                ) : (
                  <>
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    Upload
                  </>
                )}
              </Button>
            ) : null}
          </div>
        </div>

        {!disabled ? (
          <div
            className={cn(
              "flex w-full shrink-0 flex-col justify-center border-t border-border/50 bg-muted/35 p-5 sm:w-56 sm:border-t-0 sm:border-l sm:py-5 sm:pr-5 sm:pl-6",
              dragging && "bg-brand-primary/[0.06]"
            )}
          >
            {hasImage ? (
              <div
                role="button"
                tabIndex={0}
                className="relative aspect-[4/3] w-full cursor-pointer overflow-hidden rounded-md outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                onClick={triggerFileSelect}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    triggerFileSelect()
                  }
                }}
              >
                <img
                  src={imageUrl!}
                  alt={`${title} sponsor`}
                  className="h-full w-full object-contain"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={triggerFileSelect}
                disabled={uploading}
                className={cn(
                  "flex aspect-[4/3] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border/50 px-2 py-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  dragging
                    ? "border-brand-primary/50 bg-brand-primary/[0.08]"
                    : "hover:border-border hover:bg-muted/25"
                )}
              >
                <ImageIcon className="h-7 w-7 text-muted-foreground/60" strokeWidth={1.2} />
                <div className="px-1 text-center">
                  <p className="text-[11px] font-medium leading-snug text-muted-foreground/80">
                    Drop an image here or click to browse
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground/60">PNG, JPG, or SVG</p>
                </div>
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
