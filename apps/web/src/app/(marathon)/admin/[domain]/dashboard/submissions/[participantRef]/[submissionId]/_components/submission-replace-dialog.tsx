'use client'

import { useEffect, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ImageIcon, Loader2, ReplaceIcon, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useDomain } from '@/lib/domain-provider'
import { useTRPC } from '@/lib/trpc/client'
import { cn } from '@/lib/utils'
import { uploadFileToPresignedUrl } from '@/lib/upload-client'
import {
  ADMIN_REPLACE_DROPZONE_ACCEPT,
  resolveReplaceUploadContentType,
} from '../_lib/replace-upload'

interface SubmissionReplaceDialogProps {
  submissionId: number
  participantRef: string
  /** When provided, the dialog is controlled externally. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Hide the built-in trigger button (use when controlled externally). */
  hideTrigger?: boolean
}

const ACCEPTED_TYPE_LABEL = 'JPG, PNG, GIF, WebP, HEIC, HEIF'

export function SubmissionReplaceDialog({
  submissionId,
  participantRef,
  open: openProp,
  onOpenChange,
  hideTrigger = false,
}: SubmissionReplaceDialogProps) {
  const domain = useDomain()
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const isControlled = openProp !== undefined
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = isControlled ? openProp : uncontrolledOpen
  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next)
    onOpenChange?.(next)
  }
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
    toast.error('Please choose a supported image file to replace this submission.')
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
      toast.error('Choose a replacement image first')
      return
    }

    const contentType = resolveReplaceUploadContentType(selectedFile)
    if (!contentType) {
      toast.error('Unsupported image type')
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
      const message = error instanceof Error ? error.message : 'Failed to replace submission'
      toast.error(message)
    } finally {
      setIsUploadingFile(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {hideTrigger ? null : (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <ReplaceIcon className="h-4 w-4" />
            Replace
          </Button>
        </DialogTrigger>
      )}
      <DialogContent
        size="lg"
        className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0"
        onInteractOutside={(event) => {
          if (isBusy) {
            event.preventDefault()
          }
        }}
      >
        <DialogHeader className="shrink-0 gap-1.5 border-b px-6 py-4 text-left">
          <DialogTitle className="font-gothic text-xl font-normal tracking-tight">
            Replace Submission Image
          </DialogTitle>
          <DialogDescription className="max-w-2xl text-sm leading-snug text-muted-foreground">
            Upload a new file for this submission. The original object is replaced and thumbnails
            are regenerated.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-[min(360px,52dvh)] grid-cols-1 md:grid-cols-2">
          <section className="flex min-h-[280px] flex-col border-b p-6 md:min-h-0 md:border-r md:border-b-0">
            <h3 className="mb-3 shrink-0 text-sm font-medium text-foreground">Upload</h3>
            <div
              {...getRootProps()}
              className={cn(
                'flex min-h-0 flex-1 flex-col justify-center rounded-xl border border-dashed px-8 py-8 transition-colors',
                isBusy && 'cursor-progress border-border bg-muted/30',
                !isBusy &&
                  isDragActive &&
                  'cursor-copy border-foreground/50 bg-muted/60',
                !isBusy &&
                  !isDragActive &&
                  'cursor-pointer border-border bg-muted/20 hover:bg-muted/35',
              )}
            >
              <input {...getInputProps()} />
              <div className="flex max-w-md flex-col gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-border">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[15px] font-medium leading-snug">
                    {isDragActive ? 'Drop the replacement image here' : 'Drag and drop a new image'}
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Accepted formats: {ACCEPTED_TYPE_LABEL}. One file only.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" variant="secondary" size="sm" disabled={isBusy}>
                    Choose file
                  </Button>
                  {selectedFile ? (
                    <p className="truncate text-sm text-muted-foreground">
                      {selectedFile.name} · {Math.max(1, Math.round(selectedFile.size / 1024))}{' '}
                      KB
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <section className="flex min-h-[280px] flex-col p-6 md:min-h-0">
            <h3 className="mb-3 shrink-0 text-sm font-medium text-foreground">Preview</h3>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-muted/15">
              <div className="flex min-h-0 flex-1 items-center justify-center p-6">
                <ReplacePreviewContent
                  previewUrl={previewUrl}
                  previewFailed={previewFailed}
                  selectedFile={selectedFile}
                  onPreviewError={() => setPreviewFailed(true)}
                />
              </div>
              <p className="shrink-0 border-t border-border/80 bg-muted/25 px-4 py-2.5 text-xs leading-snug text-muted-foreground">
                Admin-only replacement; does not use the participant upload flow.
              </p>
            </div>
          </section>
        </div>

        <DialogFooter className="shrink-0 gap-3 border-t bg-muted/20 px-6 py-4 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isBusy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="gap-2"
            onClick={handleReplace}
            disabled={!selectedFile || isBusy}
          >
            {isBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ReplaceIcon className="h-4 w-4" />
            )}
            {isBusy ? 'Replacing...' : 'Replace Submission'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface ReplacePreviewContentProps {
  previewUrl: string | null
  previewFailed: boolean
  selectedFile: File | null
  onPreviewError: () => void
}

function ReplacePreviewContent({
  previewUrl,
  previewFailed,
  selectedFile,
  onPreviewError,
}: ReplacePreviewContentProps) {
  if (previewUrl && !previewFailed) {
    return (
      <img
        src={previewUrl}
        alt="Replacement preview"
        className="max-h-[min(280px,42dvh)] max-w-full rounded-lg object-contain shadow-sm"
        onError={onPreviewError}
      />
    )
  }

  if (selectedFile) {
    return (
      <div className="flex max-w-xs flex-col items-center gap-3 px-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-border">
          <ImageIcon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="font-medium leading-snug">{selectedFile.name}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Preview unavailable in the browser, but the file can still be uploaded.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex max-w-xs flex-col items-center gap-3 px-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-border">
        <ImageIcon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Select a file to preview the replacement image.
      </p>
    </div>
  )
}
