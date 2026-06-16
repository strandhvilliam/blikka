'use client'

import { Loader2 } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PrimaryButton } from '@/components/ui/primary-button'
import { normalizeParticipantReference } from '@/lib/staff/staff-utils'
import { useStaffUploadStore } from '@/lib/staff/staff-upload-store'

interface ReferenceStepProps {
  isSubmitting: boolean
  onSubmitAction: (reference: string) => Promise<void> | void
}

export function ReferenceStep({ isSubmitting, onSubmitAction }: ReferenceStepProps) {
  const reference = useStaffUploadStore((state) => state.formValues.reference)
  const errorMessage = useStaffUploadStore((state) => state.lookupErrorMessage)
  const setFormField = useStaffUploadStore((state) => state.setFormField)

  return (
    <div className="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center">
      <Card className="w-full max-w-md gap-0 rounded-3xl px-10 py-12 text-center shadow-lg">
        <h2 className="font-gothic text-3xl font-medium leading-none tracking-tight text-foreground">
          Enter participant number
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Prepared in advance? Their saved registration opens here. Otherwise, register them now.
        </p>

        <form
          noValidate
          className="mt-8 space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void onSubmitAction(normalizeParticipantReference(reference))
          }}
        >
          <Input
            autoFocus
            value={reference}
            onChange={(event) =>
              setFormField('reference', event.target.value.replace(/\D/g, '').slice(0, 4))
            }
            onBlur={() => {
              if (reference.length > 0) {
                setFormField('reference', normalizeParticipantReference(reference))
              }
            }}
            placeholder="0000"
            aria-label="Participant number"
            inputMode="numeric"
            maxLength={4}
            className="h-16 rounded-2xl border-input bg-background px-6 text-center font-mono text-4xl! tracking-[0.32em] text-foreground shadow-sm"
          />

          {errorMessage ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-left text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}

          <PrimaryButton
            type="submit"
            className="mt-2 w-full rounded-full px-6 py-5 text-lg"
            disabled={isSubmitting || reference.length === 0}
          >
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Find registration
          </PrimaryButton>
        </form>
      </Card>
    </div>
  )
}
