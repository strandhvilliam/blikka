"use client";

import { Loader2, SearchIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { PrimaryButton } from "@/components/ui/primary-button";
import { normalizeParticipantReference } from "../../_lib/staff-utils";
import { useStaffUploadStore } from "../_lib/staff-upload-store";

interface ReferenceStepProps {
  isSubmitting: boolean;
  onSubmitAction: (reference: string) => Promise<void> | void;
}

export function ReferenceStep({ isSubmitting, onSubmitAction }: ReferenceStepProps) {
  const reference = useStaffUploadStore((state) => state.formValues.reference);
  const errorMessage = useStaffUploadStore((state) => state.lookupErrorMessage);
  const setFormField = useStaffUploadStore((state) => state.setFormField);

  return (
    <div className="flex flex-col items-center py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
        Participant lookup
      </p>
      <h2 className="mt-3 font-gothic text-4xl font-medium leading-none tracking-tight text-foreground">
        Enter participant number
      </h2>
      <p className="mt-3 max-w-sm text-sm text-muted-foreground">
        Type the participant number. Prepared participants skip straight
        to photo selection.
      </p>

      <form
        noValidate
        className="mt-10 w-full max-w-xs space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void onSubmitAction(normalizeParticipantReference(reference));
        }}
      >
        <div className="space-y-2">
          <Input
            autoFocus
            value={reference}
            onChange={(event) =>
              setFormField(
                "reference",
                event.target.value.replace(/\D/g, "").slice(0, 4),
              )
            }
            onBlur={() => {
              if (reference.length > 0) {
                setFormField("reference", normalizeParticipantReference(reference));
              }
            }}
            placeholder="0000"
            inputMode="numeric"
            maxLength={4}
            className="h-16 rounded-2xl border-input bg-card px-6 text-center font-mono text-4xl! tracking-[0.32em] text-foreground shadow-sm"
          />
        </div>

        {errorMessage ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-left text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <PrimaryButton
          type="submit"
          className="w-full rounded-full px-6 py-5 mt-6 text-lg"
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
