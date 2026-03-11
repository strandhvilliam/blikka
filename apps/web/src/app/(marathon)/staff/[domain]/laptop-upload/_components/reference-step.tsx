"use client";

import { useForm } from "@tanstack/react-form";
import { Loader2, SearchIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PrimaryButton } from "@/components/ui/primary-button";
import { normalizeParticipantReference } from "../../_lib/staff-utils";

interface ReferenceStepProps {
  defaultReference?: string;
  isSubmitting: boolean;
  errorMessage?: string | null;
  onSubmitAction: (reference: string) => Promise<void> | void;
}

export function ReferenceStep({
  defaultReference = "",
  isSubmitting,
  errorMessage,
  onSubmitAction,
}: ReferenceStepProps) {
  const form = useForm({
    defaultValues: {
      reference: defaultReference,
    },
    onSubmit: async ({ value }) => {
      await onSubmitAction(normalizeParticipantReference(value.reference));
    },
  });

  return (
    <section className="rounded-[2rem] border border-[#ddd8ca] bg-white/90 p-8 shadow-[0_28px_90px_rgba(24,24,18,0.08)] backdrop-blur-sm">
      <div className="max-w-xl space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#7a7566]">
          Step 1
        </p>
        <h2 className="font-rocgrotesk text-4xl leading-none text-[#1d1b17]">
          Find participant
        </h2>
        <p className="text-sm text-[#666152]">
          Enter the participant number from the desk card. Prepared participants
          will go straight to upload. Missing participants continue to manual
          details entry.
        </p>
      </div>

      <form
        noValidate
        className="mt-8 space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <form.Field
          name="reference"
          validators={{
            onChange: ({ value }) =>
              /^\d{0,4}$/.test(value)
                ? undefined
                : "Participant reference must be 1-4 digits",
          }}
        >
          {(field) => {
            const hasError =
              field.state.meta.isTouched && field.state.meta.errors.length > 0;

            return (
              <div className="space-y-3">
                <label className="text-xs font-semibold uppercase tracking-[0.24em] text-[#726d5e]">
                  Participant number
                </label>
                <Input
                  autoFocus
                  value={field.state.value}
                  onChange={(event) =>
                    field.handleChange(
                      event.target.value.replace(/\D/g, "").slice(0, 4),
                    )
                  }
                  onBlur={() => {
                    if (field.state.value.length > 0) {
                      field.handleChange(
                        normalizeParticipantReference(field.state.value),
                      );
                    }
                    field.handleBlur();
                  }}
                  placeholder="0000"
                  inputMode="numeric"
                  maxLength={4}
                  className="h-20 rounded-3xl border-[#d9d4c7] bg-[#fcfbf7] px-6 text-center font-mono text-5xl tracking-[0.32em] text-[#191814]"
                />
                {hasError ? (
                  <p className="text-sm font-medium text-rose-600">
                    {field.state.meta.errors[0]}
                  </p>
                ) : null}
              </div>
            );
          }}
        </form.Field>

        {errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <PrimaryButton
            type="submit"
            className="min-w-[220px] rounded-full px-6 py-6 text-base"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <SearchIcon className="mr-2 h-4 w-4" />
            )}
            Lookup participant
          </PrimaryButton>
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => form.reset()}
            disabled={isSubmitting}
          >
            Clear
          </Button>
        </div>
      </form>
    </section>
  );
}

