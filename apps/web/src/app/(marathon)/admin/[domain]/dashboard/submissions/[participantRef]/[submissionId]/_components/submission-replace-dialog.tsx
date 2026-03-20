"use client"

import { useEffect, useState } from "react"
import { useDropzone } from "react-dropzone"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ImageIcon, Loader2, ReplaceIcon, Upload } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useDomain } from "@/lib/domain-provider"
import { useTRPC } from "@/lib/trpc/client"
import { cn } from "@/lib/utils"
import { uploadFileToPresignedUrl } from "@/lib/upload-client"
import {
  ADMIN_REPLACE_DROPZONE_ACCEPT,
  resolveReplaceUploadContentType,
} from "../_lib/replace-upload"

interface SubmissionReplaceDialogProps {
  submissionId: number
  participantRef: string
}

const ACCEPTED_TYPE_LABEL = "JPG, PNG, GIF, WebP, HEIC, HEIF"

export function SubmissionReplaceDialog({
  submissionId,
  participantRef,
}: SubmissionReplaceDialogProps) {
  const domain = useDomain()
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const [open, setOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewFailed, setPreviewFailed] = useState(false)
  const [isUploadingFile, setIsUploadingFile] = useState(false)

  const beginReplaceMutation = useMutation(
    trpc.submissions.beginAdminReplaceUpload.mutationOptions(),
  )

  const completeReplaceMutation = useMutation(
    trpc.submissions.completeAdminReplaceUpload.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Submission replaced and ${data.validationResultsCount} validations rerun`)
        queryClient.invalidateQueries({
          queryKey: trpc.participants.getByReference.queryKey({
            reference: participantRef,
            domain,
          }),
        })
        queryClient.invalidateQueries({
          queryKey: trpc.participants.getByDomainInfinite.pathKey(),
        })
        resetState()
        setOpen(false)
      },
    }),
  )

  const isBusy =
    isUploadingFile || beginReplaceMutation.isPending || completeReplaceMutation.isPending

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null)
      setPreviewFailed(false)
      return
    }

    const objectUrl = URL.createObjectURL(selectedFile)
    setPreviewUrl(objectUrl)
    setPreviewFailed(false)

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [selectedFile])

  const resetState = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    setPreviewFailed(false)
    setIsUploadingFile(false)
    beginReplaceMutation.reset()
    completeReplaceMutation.reset()
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isBusy) {
      return
    }

    if (!nextOpen) {
      resetState()
    }

    setOpen(nextOpen)
  }

  const handleDropAccepted = (files: File[]) => {
    setSelectedFile(files[0] ?? null)
  }

  const handleDropRejected = () => {
    toast.error("Please choose a supported image file to replace this submission.")
  }

  const { getInputProps, getRootProps, isDragActive } = useDropzone({
    accept: ADMIN_REPLACE_DROPZONE_ACCEPT,
    multiple: false,
    disabled: isBusy,
    onDropAccepted: handleDropAccepted,
    onDropRejected: handleDropRejected,
  })

  const handleReplace = async () => {
    if (!selectedFile) {
      toast.error("Choose a replacement image first")
      return
    }

    const contentType = resolveReplaceUploadContentType(selectedFile)
    if (!contentType) {
      toast.error("Unsupported image type")
      return
    }

    setIsUploadingFile(true)

    try {
      const beginResult = await beginReplaceMutation.mutateAsync({
        domain,
        submissionId,
        contentType,
      })

      const uploadResult = await uploadFileToPresignedUrl({
        file: selectedFile,
        presignedUrl: beginResult.presignedPutUrl,
        contentType: beginResult.contentType,
      })

      if (!uploadResult.ok) {
        throw new Error(uploadResult.error.message)
      }

      await completeReplaceMutation.mutateAsync({
        domain,
        submissionId,
        newKey: beginResult.key,
        previousKey: beginResult.previousKey,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to replace submission"
      toast.error(message)
    } finally {
      setIsUploadingFile(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <ReplaceIcon className="h-4 w-4" />
          Replace
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-4xl overflow-hidden p-0"
        onInteractOutside={(event) => {
          if (isBusy) {
            event.preventDefault()
          }
        }}
      >
        <DialogHeader className="border-b px-6 py-5 text-left">
          <DialogTitle className="font-gothic text-xl font-normal tracking-tight">
            Replace Submission Image
          </DialogTitle>
          <DialogDescription>
            Upload a new file for this submission. The original object is replaced, thumbnails are
            regenerated, and validations run again automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-0 md:grid-cols-[1.1fr_0.9fr]">
          <div className="border-b px-6 py-6 md:border-r md:border-b-0">
            <div
              {...getRootProps()}
              className={cn(
                "rounded-xl border border-dashed p-6 transition-colors",
                isBusy
                  ? "cursor-progress border-border bg-muted/30"
                  : isDragActive
                    ? "cursor-copy border-foreground/50 bg-muted/60"
                    : "cursor-pointer border-border bg-muted/20 hover:bg-muted/35",
              )}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-border">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium">
                    {isDragActive ? "Drop the replacement image here" : "Drag and drop a new image"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Accepted formats: {ACCEPTED_TYPE_LABEL}. Only one file can be uploaded.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" variant="secondary" size="sm" disabled={isBusy}>
                    Choose File
                  </Button>
                  {selectedFile ? (
                    <p className="text-sm text-muted-foreground">
                      {selectedFile.name} ({Math.max(1, Math.round(selectedFile.size / 1024))} KB)
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-6">
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">Preview</h3>
              <div className="flex min-h-[280px] items-center justify-center rounded-xl border bg-muted/20 p-4">
                {previewUrl && !previewFailed ? (
                  <img
                    src={previewUrl}
                    alt="Replacement preview"
                    className="max-h-[320px] w-auto max-w-full rounded-lg object-contain shadow-sm"
                    onError={() => setPreviewFailed(true)}
                  />
                ) : selectedFile ? (
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-border">
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Preview unavailable in the browser, but the file can still be uploaded.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-border">
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Select a file to preview the replacement image.
                    </p>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                This is an admin-only replacement and does not use the participant upload flow.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t px-6 py-4 sm:justify-between">
          <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button type="button" className="gap-2" onClick={handleReplace} disabled={!selectedFile || isBusy}>
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ReplaceIcon className="h-4 w-4" />}
            {isBusy ? "Replacing..." : "Replace Submission"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
