'use client'

import { useSuspenseQuery } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { PrimaryButton } from '@/components/ui/primary-button'
import { useDomain } from '@/lib/domain-provider'
import { useTRPC } from '@/lib/trpc/client'
import type { UploadMarathonMode } from '@/lib/types'
import { StaffParticipantCard } from '@/components/staff/staff-participant-card'
import { StaffUploadedPhotoGrid } from '@/components/staff/staff-uploaded-photo-grid'
import { useStaffUploadParticipantSummary } from '@/hooks/staff/use-staff-upload-participant-summary'
import { useStaffUploadStep } from '@/hooks/staff/use-staff-upload-step'
import { useStaffUploadStore } from '@/lib/staff/staff-upload-store'

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
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <StaffParticipantCard {...participantSummary} statusLabel="Uploaded" statusTone="success" />

      <Card className="gap-6 rounded-3xl px-6 py-6 shadow-lg">
        <div className="flex flex-col items-center px-6 py-8 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
            <CheckCircle2 className="h-11 w-11" />
          </div>
          <h2 className="mt-4 font-gothic text-3xl font-medium leading-none tracking-tight text-foreground">
            Upload complete
          </h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            All files uploaded for participant #{participantSummary.reference}. Ready for the next
            participant.
          </p>
          <PrimaryButton
            type="button"
            className="mt-6 rounded-full bg-emerald-700 px-8 py-4 text-base hover:bg-emerald-800"
            onClick={() => {
              resetAllState()
              void setStep(marathonMode === 'by-camera' ? 'phone' : 'reference')
            }}
          >
            Next participant
          </PrimaryButton>
        </div>

        <StaffUploadedPhotoGrid />
      </Card>
    </div>
  )
}
