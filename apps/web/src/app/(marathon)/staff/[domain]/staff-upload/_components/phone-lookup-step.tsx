"use client"

import { Loader2, SearchIcon } from "lucide-react"
import { isPossiblePhoneNumber } from "react-phone-number-input"

import { PhoneInput } from "@/components/ui/phone-input"
import { PrimaryButton } from "@/components/ui/primary-button"
import { useStaffUploadStore } from "../_lib/staff-upload-store"

interface PhoneLookupStepProps {
  isSubmitting: boolean
  onSubmitAction: (phoneNumber: string) => Promise<void> | void
}

export function PhoneLookupStep({ isSubmitting, onSubmitAction }: PhoneLookupStepProps) {
  const phone = useStaffUploadStore((state) => state.formValues.phone)
  const errorMessage = useStaffUploadStore((state) => state.lookupErrorMessage)
  const setFormField = useStaffUploadStore((state) => state.setFormField)

  const phoneValid = phone.trim().length > 0 && isPossiblePhoneNumber(phone)

  return (
    <div className="flex flex-col items-center py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
        Participant lookup
      </p>
      <h2 className="mt-3 font-gothic text-4xl font-medium leading-none tracking-tight text-foreground">
        Enter phone number
      </h2>
      <p className="mt-3 max-w-sm text-sm text-muted-foreground">
        We use the phone number to find an existing participant or continue with someone new.
      </p>

      <form
        noValidate
        className="mt-10 w-full max-w-xs space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          event.stopPropagation()
          if (!phoneValid) return
          void onSubmitAction(phone.trim())
        }}
      >
        <div className="space-y-2 text-left">
          <label className="text-sm font-medium text-foreground">Phone number</label>
          <PhoneInput
            value={phone}
            onChange={(next) => setFormField("phone", next ?? "")}
            defaultCountry="SE"
            className="h-12 rounded-xl [&_input]:h-12 [&_input]:rounded-e-xl [&_input]:rounded-s-none [&_input]:text-base"
          />
        </div>

        {errorMessage ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-left text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <PrimaryButton
          type="submit"
          className="mt-6 w-full rounded-full px-6 py-5 text-lg"
          disabled={isSubmitting || !phoneValid}
        >
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <SearchIcon className="mr-2 h-4 w-4" />
          )}
          Continue
        </PrimaryButton>
      </form>
    </div>
  )
}
