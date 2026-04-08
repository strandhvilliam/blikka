"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

interface PreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageUrl: string | null
}

export function PreviewDialog({ open, onOpenChange, imageUrl }: PreviewDialogProps) {
  const [isBroken, setIsBroken] = useState(false)

  useEffect(() => {
    if (open) {
      setIsBroken(false)
    }
  }, [open, imageUrl])

  if (!imageUrl) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl overflow-hidden border-none bg-black p-0">
        <DialogTitle className="sr-only">Submission preview</DialogTitle>
        <div className="relative flex min-h-[40vh] items-center justify-center bg-black">
          {isBroken ? (
            <div className="flex h-[40vh] items-center justify-center text-sm text-white/70">
              Image preview unavailable
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt="Submission preview"
              className="max-h-[85vh] w-full object-contain"
              onError={() => setIsBroken(true)}
            />
          )}
          <Button className="absolute bottom-4 right-4" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
