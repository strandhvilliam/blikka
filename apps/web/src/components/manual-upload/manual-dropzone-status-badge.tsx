"use client"

import { Camera, CheckCircle2, Loader2 } from "lucide-react"

export type ManualDropzoneVariant = "disabled" | "ready" | "complete" | "success" | "processing"

interface ManualDropzoneStatusBadgeProps {
  variant: ManualDropzoneVariant
  isProcessing?: boolean
}

export function ManualDropzoneStatusBadge({
  variant,
  isProcessing = false,
}: ManualDropzoneStatusBadgeProps) {
  if (variant === "processing") {
    return (
      <>
        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin text-amber-600" />
        <span className="text-amber-700">{isProcessing ? "Processing..." : "Working..."}</span>
      </>
    )
  }

  if (variant === "complete" || variant === "success") {
    return (
      <>
        <CheckCircle2 className="mr-2 h-3.5 w-3.5 text-emerald-600" />
        <span className="text-emerald-700">{variant === "complete" ? "Complete" : "Done"}</span>
      </>
    )
  }

  if (variant === "disabled") {
    return (
      <>
        <Camera className="mr-2 h-3.5 w-3.5 text-slate-400" />
        <span className="text-slate-500">Waiting...</span>
      </>
    )
  }

  return (
    <>
      <Camera className="mr-2 h-3.5 w-3.5 text-[#4f4f48]" />
      <span className="text-[#4f4f48]">Select Images</span>
    </>
  )
}
