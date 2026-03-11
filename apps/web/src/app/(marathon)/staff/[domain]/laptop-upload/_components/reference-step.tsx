"use client";

import { useForm } from "@tanstack/react-form";
import { Loader2, SearchIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
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
    <div className="flex flex-col items-center py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
        Participant lookup
      </p>
      <h2 className="mt-3 font-rocgrotesk text-4xl leading-none text-foreground">
        Enter participant number
      </h2>
      <p className="mt-3 max-w-sm text-sm text-muted-foreground">
        Type the number from the desk card. Prepared participants skip straight
        to photo selection.
      </p>

      <form
        noValidate
        className="mt-10 w-full max-w-xs space-y-4"
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
              <div className="space-y-2">
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
                  className="h-16 rounded-2xl border-input bg-card px-6 text-center font-mono text-4xl tracking-[0.32em] text-foreground shadow-sm"
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
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-left text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <PrimaryButton
          type="submit"
          className="w-full rounded-full px-6 py-5 text-base"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <SearchIcon className="mr-2 h-4 w-4" />
          )}
          Lookup participant
        </PrimaryButton>
      </form>
    </div>
  );
}
