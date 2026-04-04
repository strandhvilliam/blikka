"use client"

import { useSuspenseQuery } from "@tanstack/react-query"
import { CheckCircle2, RotateCcw } from "lucide-react"
import { PrimaryButton } from "@/components/ui/primary-button"
import { useDomain } from "@/lib/domain-provider"
import { useTRPC } from "@/lib/trpc/client"
import type { UploadMarathonMode } from "@/lib/types"
import { StaffParticipantCard } from "./staff-participant-card"
import { useStaffUploadParticipantSummary } from "../_hooks/use-staff-upload-participant-summary"
import { useStaffUploadStep } from "../_hooks/use-staff-upload-step"
import { useStaffUploadStore } from "../_lib/staff-upload-store"

export function UploadCompletePanel() {
  const domain = useDomain()
  const trpc = useTRPC()
  const { data: marathon } = useSuspenseQuery(trpc.marathons.getByDomain.queryOptions({ domain }))
  const marathonMode = marathon.mode as UploadMarathonMode

  const [, setStep] = useStaffUploadStep()
  const resetAllState = useStaffUploadStore((state) => state.resetAllState)
  const participantSummary = useStaffUploadParticipantSummary()

  if (!participantSummary) {
    return null
  }

  return (
    <div className="space-y-5">
      <StaffParticipantCard {...participantSummary} statusLabel="Uploaded" statusTone="success" />

      <div className="flex flex-col items-center rounded-2xl border border-emerald-200 bg-emerald-50/50 px-8 py-14 text-center shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h2 className="mt-5 font-gothic text-3xl font-medium leading-none tracking-tight text-emerald-950">
          Upload complete
        </h2>
        <p className="mt-3 max-w-sm text-sm text-emerald-800">
          All files uploaded for participant #{participantSummary.reference}. Ready for the next
          participant.
        </p>
        <PrimaryButton
          type="button"
          className="mt-8 rounded-full bg-emerald-700 px-8 py-4 text-base hover:bg-emerald-800"
          onClick={() => {
            resetAllState()
            void setStep(marathonMode === "by-camera" ? "phone" : "reference")
          }}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Next participant
        </PrimaryButton>
      </div>
    </div>
  )
}
