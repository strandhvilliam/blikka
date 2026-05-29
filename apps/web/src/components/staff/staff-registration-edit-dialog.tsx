'use client'

import { useEffect, useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { PrimaryButton } from '@/components/ui/primary-button'
import { useDomain } from '@/lib/domain-provider'
import type { StaffParticipant } from '@/lib/staff/staff-types'
import { useTRPC } from '@/lib/trpc/client'
import { cn } from '@/lib/utils'
import type { CompetitionClass, DeviceGroup } from '@blikka/db'

const registrationSchema = z.object({
  firstname: z.string().trim().min(1, 'First name is required'),
  lastname: z.string().trim().min(1, 'Last name is required'),
  email: z.string().trim().email('Enter a valid email address'),
  competitionClassId: z.string().min(1, 'Select a competition class'),
  deviceGroupId: z.string().min(1, 'Select a device'),
})

type RegistrationFormValues = z.infer<typeof registrationSchema>

interface StaffRegistrationEditDialogProps {
  participant: StaffParticipant
  competitionClasses: CompetitionClass[]
  deviceGroups: DeviceGroup[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (participant: StaffParticipant, resetReason: 'class' | 'device' | null) => void
}

export function StaffRegistrationEditDialog({
  participant,
  competitionClasses,
  deviceGroups,
  open,
  onOpenChange,
  onSaved,
}: StaffRegistrationEditDialogProps) {
  const domain = useDomain()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const defaultValues: RegistrationFormValues = {
    firstname: participant.firstname,
    lastname: participant.lastname,
    email: participant.email ?? '',
    competitionClassId: String(participant.competitionClassId ?? ''),
    deviceGroupId: String(participant.deviceGroupId ?? ''),
  }

  const updateRegistration = useMutation(
    trpc.participants.updateMarathonParticipantRegistration.mutationOptions({
      onSuccess: (updatedParticipant) => {
        void queryClient.invalidateQueries({
          queryKey: trpc.participants.getByReference.queryKey({
            domain,
            reference: participant.reference,
          }),
        })
        void queryClient.invalidateQueries({
          queryKey: trpc.participants.getByDomainInfinite.pathKey(),
        })

        const classChanged = updatedParticipant.competitionClassId !== participant.competitionClassId
        const deviceChanged = updatedParticipant.deviceGroupId !== participant.deviceGroupId
        onSaved(
          updatedParticipant as StaffParticipant,
          classChanged ? 'class' : deviceChanged ? 'device' : null,
        )
        setErrorMessage(null)
        onOpenChange(false)
      },
      onError: (error) => {
        setErrorMessage(error.message || 'Failed to update registration')
      },
    }),
  )

  const form = useForm({
    defaultValues,
    validators: {
      onSubmit: ({ value }) => {
        const result = registrationSchema.safeParse(value)
        if (result.success) return undefined
        const errors = result.error.flatten().fieldErrors
        return {
          fields: {
            firstname: errors.firstname?.[0],
            lastname: errors.lastname?.[0],
            email: errors.email?.[0],
            competitionClassId: errors.competitionClassId?.[0],
            deviceGroupId: errors.deviceGroupId?.[0],
          },
        }
      },
    },
    onSubmit: async ({ value }) => {
      const parsed = registrationSchema.safeParse(value)
      if (!parsed.success) return
      setErrorMessage(null)

      await updateRegistration.mutateAsync({
        domain,
        reference: participant.reference,
        firstname: parsed.data.firstname,
        lastname: parsed.data.lastname,
        email: parsed.data.email,
        competitionClassId: Number(parsed.data.competitionClassId),
        deviceGroupId: Number(parsed.data.deviceGroupId),
      })
    },
  })

  useEffect(() => {
    if (!open) return
    form.reset(defaultValues)
    setErrorMessage(null)
    // Reset to the selected participant every time the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, participant.id])

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen)
    if (!nextOpen) {
      form.reset(defaultValues)
      setErrorMessage(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-gothic">Edit registration</DialogTitle>
          <DialogDescription>
            Correct the participant details before attaching photos. The participant number cannot
            be changed.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void form.handleSubmit()
          }}
        >
          {errorMessage ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : null}

          <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Participant number
            </p>
            <p className="mt-1 font-mono text-2xl font-bold tracking-wide text-foreground">
              {participant.reference}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <form.Field name="firstname">
              {(field) => (
                <TextField field={field} label="First name" autoComplete="given-name" />
              )}
            </form.Field>
            <form.Field name="lastname">
              {(field) => (
                <TextField field={field} label="Last name" autoComplete="family-name" />
              )}
            </form.Field>
          </div>

          <form.Field name="email">
            {(field) => (
              <TextField field={field} label="Email" type="email" autoComplete="email" />
            )}
          </form.Field>

          <form.Field name="competitionClassId">
            {(field) => (
              <OptionGroup
                label="Competition class"
                error={field.state.meta.errors[0]?.toString()}
                options={competitionClasses.map((competitionClass) => ({
                  id: String(competitionClass.id),
                  title: competitionClass.name,
                  description:
                    competitionClass.numberOfPhotos === 1
                      ? '1 photo'
                      : `${competitionClass.numberOfPhotos} photos`,
                }))}
                selectedId={field.state.value}
                onSelect={(value) => field.handleChange(value)}
              />
            )}
          </form.Field>

          <form.Field name="deviceGroupId">
            {(field) => (
              <OptionGroup
                label="Device"
                error={field.state.meta.errors[0]?.toString()}
                options={deviceGroups.map((deviceGroup) => ({
                  id: String(deviceGroup.id),
                  title: deviceGroup.name,
                  description: deviceGroup.description || 'Photo source',
                }))}
                selectedId={field.state.value}
                onSelect={(value) => field.handleChange(value)}
              />
            )}
          </form.Field>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={updateRegistration.isPending}
            >
              Cancel
            </Button>
            <PrimaryButton type="submit" disabled={updateRegistration.isPending}>
              {updateRegistration.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save changes'
              )}
            </PrimaryButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function TextField({
  field,
  label,
  type = 'text',
  autoComplete,
}: {
  field: {
    name: string
    state: { value: string; meta: { errors: unknown[]; isTouched: boolean } }
    handleBlur: () => void
    handleChange: (value: string) => void
  }
  label: string
  type?: string
  autoComplete: string
}) {
  const error = field.state.meta.isTouched ? field.state.meta.errors[0]?.toString() : undefined

  return (
    <div className="space-y-2">
      <label htmlFor={field.name} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <Input
        id={field.name}
        name={field.name}
        type={type}
        autoComplete={autoComplete}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        className={cn(
          'h-11 rounded-xl',
          error && 'border-destructive focus-visible:ring-destructive',
        )}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

function OptionGroup({
  label,
  error,
  options,
  selectedId,
  onSelect,
}: {
  label: string
  error: string | undefined
  options: { id: string; title: string; description: string }[]
  selectedId: string
  onSelect: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label={label}>
        {options.map((option) => {
          const selected = option.id === selectedId
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelect(option.id)}
              className={cn(
                'flex min-h-[72px] items-start justify-between gap-3 rounded-xl border px-3 py-3 text-left transition-colors',
                selected
                  ? 'border-primary bg-primary/5 text-foreground'
                  : 'border-border bg-background hover:bg-muted/50',
              )}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{option.title}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {option.description}
                </span>
              </span>
              <CheckCircle2
                className={cn(
                  'mt-0.5 h-4 w-4 shrink-0 transition-opacity',
                  selected ? 'opacity-100 text-primary' : 'opacity-0',
                )}
              />
            </button>
          )
        })}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
