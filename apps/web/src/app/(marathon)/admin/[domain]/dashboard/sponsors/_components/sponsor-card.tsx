"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Upload, Image as ImageIcon } from "lucide-react"
import { toast } from "sonner"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import type { Sponsor } from "@blikka/db"
import { cn } from "@/lib/utils"

type SponsorType = "contact-sheets" | "live-initial-1" | "live-initial-2" | "live-success-1" | "live-success-2"

function getSponsorUploadButtonLabel({
  uploading,
  hasSponsor,
}: {
  uploading: boolean
  hasSponsor: boolean
}) {
  if (uploading) return "Uploading..."
  if (hasSponsor) return "Replace Image"
  return "Upload Image"
}

interface SponsorCardProps {
  title: string
  description: string
  type: SponsorType
  disabled?: boolean
  sponsor?: Sponsor | null
}

export function SponsorCard({
  title,
  description,
  type,
  disabled = false,
  sponsor,
}: SponsorCardProps) {
  const [uploading, setUploading] = useState(false)
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

      try {
        const response = await fetch(url, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type,
          },
        })

        if (!response.ok) {
          console.error("Failed to upload file:", response.statusText)
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
        toast.error("Failed to upload file to S3")
        setUploading(false)
      }
    } catch (error) {
      console.error("Upload failed:", error)
      toast.error("Failed to upload sponsor image")
      setUploading(false)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
  }

  // Construct image URL from S3
  // Sponsor images are stored in the marathon settings bucket
  const imageUrl = sponsor
    ? `https://s3.eu-north-1.amazonaws.com/${process.env.NEXT_PUBLIC_MARATHON_SETTINGS_BUCKET_NAME}/${sponsor.key}`
    : null

  return (
    <Card className={cn("py-6", disabled ? "opacity-50" : "")}>
      <CardHeader className="space-y-0">
        <CardTitle className="flex items-center gap-2 text-lg font-gothic">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {imageUrl ? (
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
            <img
              src={imageUrl}
              alt="Sponsor"
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>
        ) : (
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <ImageIcon className="h-12 w-12 mx-auto mb-2" />
              <p>No image selected</p>
            </div>
          </div>
        )}

        {disabled ? (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Coming Soon...</p>
          </div>
        ) : (
          <div className="flex justify-center">
            <Button
              variant="outline"
              disabled={uploading}
              onClick={() => {
                const input = document.createElement("input")
                input.type = "file"
                input.accept = "image/*"
                input.onchange = (event: unknown) => handleFileSelect(event as unknown as React.ChangeEvent<HTMLInputElement>)
                input.click()
              }}
            >
              <Upload className="h-4 w-4 mr-2" />
              {getSponsorUploadButtonLabel({ uploading, hasSponsor: !!sponsor })}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
