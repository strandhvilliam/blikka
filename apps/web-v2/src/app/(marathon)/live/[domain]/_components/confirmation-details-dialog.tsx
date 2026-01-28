"use client"

import { useEffect, useState } from "react"
import { Calendar, Clock, Loader2 } from "lucide-react"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export function ConfirmationDetailsDialog({
  image,
  open,
  onOpenChange,
}: {
  image: { thumbnailUrl: string | undefined; name: string; orderIndex: number } | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
  }, [image?.orderIndex])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            #{(image?.orderIndex ?? 0) + 1} {image?.name}
          </DialogTitle>
          <DialogDescription>Photo details</DialogDescription>
        </DialogHeader>

        <div className="relative mt-2">
          <div className="rounded-md overflow-hidden bg-black/5 aspect-square sm:aspect-auto min-h-[200px] flex items-center justify-center">
            {isLoading && image?.thumbnailUrl && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/5">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
            {image?.thumbnailUrl ? (
              <img
                src={image?.thumbnailUrl}
                alt={image?.name ?? "Preview"}
                className={`w-full h-auto max-h-[60vh] object-contain transition-opacity duration-300 ${isLoading ? "opacity-0" : "opacity-100"
                  }`}
                onLoad={() => setIsLoading(false)}
              />
            ) : (
              <div className="text-sm text-muted-foreground">Preview unavailable</div>
            )}
          </div>
        </div>

        <div className="grid gap-4 py-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 opacity-70" />
            <div className="text-sm text-muted-foreground">
              Uploaded {new Date().toLocaleDateString()}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
