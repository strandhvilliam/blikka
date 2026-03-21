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

type SponsorType = "contact-sheets" | "live-initial-1" | "live-initial-2" | "live-success-1" | "live-success-2"

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
        "group relative rounded-xl border bg-white transition-shadow duration-200",
        disabled
          ? "border-border/60 opacity-60"
          : hasImage
            ? "border-brand-primary/20 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)]"
            : "border-border hover:border-border/80 hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.04)]",
        dragging && !disabled && "border-brand-primary/40 bg-brand-primary/[0.02] shadow-[0_2px_16px_-2px_rgba(0,0,0,0.08)]"
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

      <div className="flex items-start gap-4 p-5">
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

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3
                className={cn(
                  "text-[15px] font-semibold tracking-tight transition-colors duration-200",
                  hasImage && !disabled ? "text-foreground" : "text-foreground/70"
                )}
              >
                {title}
              </h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed mt-0.5">
                {description}
              </p>
            </div>

            {disabled ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                <Clock className="h-3 w-3" />
                Coming soon
              </span>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={triggerFileSelect}
                className="shrink-0 text-xs"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Uploading…
                  </>
                ) : hasImage ? (
                  <>
                    <Replace className="h-3.5 w-3.5 mr-1.5" />
                    Replace
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    Upload
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {!disabled && (
        <div className="mx-5 mb-5 pt-0">
          {hasImage ? (
            <div
              className="relative overflow-hidden rounded-lg border border-border/50 bg-[#f8f7f6] cursor-pointer transition-shadow duration-200 hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)]"
              onClick={triggerFileSelect}
            >
              <img
                src={imageUrl}
                alt={`${title} sponsor`}
                className="w-full h-auto max-h-48 object-contain p-4"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={triggerFileSelect}
              disabled={uploading}
              className={cn(
                "w-full rounded-lg border-2 border-dashed py-8 transition-colors duration-200 cursor-pointer",
                dragging
                  ? "border-brand-primary/40 bg-brand-primary/[0.03]"
                  : "border-border/60 hover:border-border hover:bg-muted/30"
              )}
            >
              <div className="flex flex-col items-center gap-2 text-muted-foreground/60">
                <ImageIcon className="h-8 w-8" strokeWidth={1.2} />
                <div className="text-center">
                  <p className="text-[13px] font-medium text-muted-foreground/80">
                    Drop an image here or click to browse
                  </p>
                  <p className="text-[11px] mt-0.5">PNG, JPG, or SVG</p>
                </div>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
