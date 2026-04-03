"use client"

import { useEffect, useState } from "react"
import { useForm } from "@tanstack/react-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { isPossiblePhoneNumber } from "react-phone-number-input"
import { z } from "zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { PhoneInput } from "@/components/ui/phone-input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"
import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import type { Participant } from "@blikka/db"
import { PrimaryButton } from "@/components/ui/primary-button"

const marathonContactSchema = z.object({
  firstname: z.string().trim().min(1, "First name is required"),
  lastname: z.string().trim().min(1, "Last name is required"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
})

const byCameraContactSchema = marathonContactSchema.extend({
  phone: z
    .string()
    .min(1, "Phone number is required")
    .refine(isPossiblePhoneNumber, "Enter a valid phone number"),
})

export type ParticipantWithPhoneNumber = Participant & {
  phoneNumber?: string | null
}

export type ParticipantContactEditMode = "by-camera" | "marathon"

interface ParticipantContactEditDialogProps {
  participantRef: string
  participant: ParticipantWithPhoneNumber
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  /** When `marathon`, phone is hidden and only name/email are saved. */
  mode?: ParticipantContactEditMode
}

export function ParticipantContactEditDialog({
  participantRef,
  participant,
  isOpen,
  onOpenChange,
  mode = "by-camera",
}: ParticipantContactEditDialogProps) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const domain = useDomain()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      firstname: participant.firstname,
      lastname: participant.lastname,
      email: participant.email ?? "",
      phone: participant.phoneNumber ?? "",
    },
    validators: {
      onSubmit: ({ value }) => {
        if (mode === "marathon") {
          const result = marathonContactSchema.safeParse(value)
          if (result.success) return undefined
          const fieldErrors = result.error.flatten().fieldErrors
          return {
            fields: {
              firstname: fieldErrors.firstname?.[0],
              lastname: fieldErrors.lastname?.[0],
              email: fieldErrors.email?.[0],
            },
          }
        }
        const result = byCameraContactSchema.safeParse(value)
        if (result.success) return undefined
        const fieldErrors = result.error.flatten().fieldErrors
        return {
          fields: {
            firstname: fieldErrors.firstname?.[0],
            lastname: fieldErrors.lastname?.[0],
            email: fieldErrors.email?.[0],
            phone: fieldErrors.phone?.[0],
          },
        }
      },
    },
    onSubmit: async ({ value }) => {
      if (mode === "marathon") {
        const parsed = marathonContactSchema.safeParse(value)
        if (!parsed.success) return
        setErrorMessage(null)
        updateMarathonContact({
          domain,
          reference: participantRef,
          firstname: parsed.data.firstname,
          lastname: parsed.data.lastname,
          email: parsed.data.email,
        })
        return
      }
      const parsed = byCameraContactSchema.safeParse(value)
      if (!parsed.success) return
      setErrorMessage(null)
      updateByCameraContact({
        domain,
        reference: participantRef,
        firstname: parsed.data.firstname,
        lastname: parsed.data.lastname,
        email: parsed.data.email,
        phone: parsed.data.phone,
      })
    },
  })

  useEffect(() => {
    if (!isOpen) {
      return
    }
    form.setFieldValue("firstname", participant.firstname)
    form.setFieldValue("lastname", participant.lastname)
    form.setFieldValue("email", participant.email ?? "")
    form.setFieldValue("phone", participant.phoneNumber ?? "")
  }, [form, participant, isOpen])

  const invalidateParticipantQueries = () => {
    void queryClient.invalidateQueries({
      queryKey: trpc.participants.getByReference.queryKey({
        reference: participantRef,
        domain,
      }),
    })
    void queryClient.invalidateQueries({
      queryKey: trpc.participants.getByDomainInfinite.pathKey(),
    })
  }

  const { mutate: updateByCameraContact, isPending: isByCameraPending } = useMutation(
    trpc.participants.updateByCameraParticipantContact.mutationOptions({
      onSuccess: () => {
        toast.success("Participant details updated")
        invalidateParticipantQueries()
        onOpenChange(false)
        setErrorMessage(null)
      },
      onError: (error) => {
        setErrorMessage(error.message || "Failed to update participant")
      },
    }),
  )

  const { mutate: updateMarathonContact, isPending: isMarathonPending } = useMutation(
    trpc.participants.updateMarathonParticipantContact.mutationOptions({
      onSuccess: () => {
        toast.success("Participant details updated")
        invalidateParticipantQueries()
        onOpenChange(false)
        setErrorMessage(null)
      },
      onError: (error) => {
        setErrorMessage(error.message || "Failed to update participant")
      },
    }),
  )

  const isPending = mode === "by-camera" ? isByCameraPending : isMarathonPending

  const handleOpenChange = (open: boolean) => {
    onOpenChange(open)
    if (!open) {
      setErrorMessage(null)
      form.reset({
        firstname: participant.firstname,
        lastname: participant.lastname,
        email: participant.email ?? "",
        phone: participant.phoneNumber ?? "",
      })
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-gothic">Edit participant details</DialogTitle>
          <DialogDescription>
            {mode === "by-camera" ? (
              <>
                Update name, email, and phone for this by-camera participant. The phone number must
                stay unique within this marathon.
              </>
            ) : (
              <>Update name and email for this participant.</>
            )}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void form.handleSubmit()
          }}
          className="space-y-4"
        >
          {errorMessage ? (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          <form.Field name="firstname">
            {(field) => (
              <div className="space-y-2">
                <label htmlFor={field.name} className="text-sm font-medium">
                  First name
                </label>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  autoComplete="given-name"
                />
                {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
                  <p className="text-sm text-destructive">{field.state.meta.errors.join(", ")}</p>
                ) : null}
              </div>
            )}
          </form.Field>

          <form.Field name="lastname">
            {(field) => (
              <div className="space-y-2">
                <label htmlFor={field.name} className="text-sm font-medium">
                  Last name
                </label>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  autoComplete="family-name"
                />
                {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
                  <p className="text-sm text-destructive">{field.state.meta.errors.join(", ")}</p>
                ) : null}
              </div>
            )}
          </form.Field>

          <form.Field name="email">
            {(field) => (
              <div className="space-y-2">
                <label htmlFor={field.name} className="text-sm font-medium">
                  Email
                </label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="email"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  autoComplete="email"
                />
                {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
                  <p className="text-sm text-destructive">{field.state.meta.errors.join(", ")}</p>
                ) : null}
              </div>
            )}
          </form.Field>

          {mode === "by-camera" ? (
            <form.Field name="phone">
              {(field) => (
                <div className="space-y-2">
                  <label htmlFor={field.name} className="text-sm font-medium">
                    Phone
                  </label>
                  <PhoneInput
                    id={field.name}
                    international
                    defaultCountry="SE"
                    value={field.state.value || undefined}
                    onBlur={field.handleBlur}
                    onChange={(v) => field.handleChange(v ?? "")}
                  />
                  {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
                    <p className="text-sm text-destructive">{field.state.meta.errors.join(", ")}</p>
                  ) : null}
                </div>
              )}
            </form.Field>
          ) : null}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <PrimaryButton type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </PrimaryButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
