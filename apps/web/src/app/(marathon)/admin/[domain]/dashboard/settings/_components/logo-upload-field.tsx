"use client"

import { ImagePlus, X } from "lucide-react"
import { Label } from "@/components/ui/label"

const UPLOAD_HINT = "PNG, JPG, SVG • 400x400px • 2MB"

interface LogoUploadFieldProps {
  previewUrl: string | null
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onRemove: () => void
}

export function LogoUploadField({
  previewUrl,
  fileInputRef,
  onRemove,
}: LogoUploadFieldProps) {
  return (
    <div className="space-y-2">
      <Label>Logo</Label>
      <div className="relative">
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          className="hidden"
          id="logo-upload"
        />
        {previewUrl ? (
          <div className="flex items-center gap-3">
            <div className="w-[42px] h-[42px] flex items-center justify-center rounded-full overflow-hidden shrink-0">
              <img
                src={previewUrl}
                alt="Contest logo"
                width={42}
                height={42}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="w-full flex-1 relative h-[42px] rounded-lg overflow-hidden border bg-background flex items-center justify-between gap-3">
              <div className="flex items-center justify-between h-full flex-1 pr-3">
                <button
                  type="button"
                  onClick={onRemove}
                  className="flex items-center gap-2 px-3 h-full hover:bg-muted rounded-md text-foreground hover:text-destructive transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label="Remove logo"
                >
                  <X className="h-4 w-4" aria-hidden />
                  <span className="text-sm">Remove logo</span>
                </button>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {UPLOAD_HINT}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-[42px] h-[42px] rounded-full bg-muted flex items-center justify-center shrink-0">
              <ImagePlus
                className="h-5 w-5 text-muted-foreground"
                aria-hidden
              />
            </div>
            <label
              htmlFor="logo-upload"
              className="px-4 w-full flex items-center h-[42px] rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 bg-background transition-colors cursor-pointer gap-3"
            >
              <div className="flex items-center justify-between flex-1">
                <span className="text-sm text-muted-foreground">
                  Click to upload logo…
                </span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {UPLOAD_HINT}
                </span>
              </div>
            </label>
          </div>
        )}
      </div>
    </div>
  )
}
