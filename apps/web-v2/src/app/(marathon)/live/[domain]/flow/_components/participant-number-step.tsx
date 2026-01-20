"use client";
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PrimaryButton } from "@/components/ui/primary-button";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { Marathon } from "@blikka/db";
import { useDomain } from "@/lib/domain-provider";
import { useTranslations } from "next-intl";
import { useUploadFlowState } from "../_hooks/use-upload-flow-state";
import { Schema } from "effect";

const createInitializeParticipantSchema = (t: ReturnType<typeof useTranslations>) =>
  Schema.standardSchemaV1(
    Schema.Struct({
      participantRef: Schema.String
        .pipe(Schema.minLength(1))
        .pipe(Schema.pattern(/^\d+$/))
        .annotations({ description: t("participantNumber.required") }),
      domain: Schema.String.pipe(Schema.minLength(1)).annotations({ description: "Invalid domain" }),
    })
  );

interface Props {
  marathon: Marathon;
}

export function ParticipantNumberStep({ marathon }: Props) {

  const domain = useDomain();
  const t = useTranslations("FlowPage");
  const {
    submissionState,
    setSubmissionState,
    handleNextStep,
    handlePrevStep,
    handleSetStep,
  } = useUploadFlowState();

  const form = useForm({
    defaultValues: {
      participantRef: submissionState.participantRef ?? "",
      domain,
    },
    onSubmit: async ({ value }) => {
      // check if participant exists
    },
    validators: {
      onChange: createInitializeParticipantSchema(t),
    },
  });



  return (
    <div className="max-w-md mx-auto min-h-[80vh] flex flex-col justify-center">
      <CardHeader className="space-y-4">
        <CardTitle className="text-2xl font-rocgrotesk font-bold text-center">
          {t("participantNumber.title")}
        </CardTitle>
        <CardDescription className="text-center">
          {!!submissionState.participantId
            ? t("participantNumber.descriptionAlreadyExists")
            : t("participantNumber.description")}
        </CardDescription>
      </CardHeader>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="space-y-6"
      >
        <CardContent className="space-y-6">
          <div>
            <form.Field
              name="participantRef"
              children={(field) => (
                <>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="0000"
                    className="text-center !text-4xl h-16 bg-background tracking-widest"
                    disabled={!!submissionState.participantId}
                    maxLength={4}
                    value={field.state.value}
                    onChange={(e) => {
                      const value = e.target.value;
                      const numericValue = value.replace(/\D/g, "").slice(0, 4);
                      field.handleChange(numericValue);
                    }}
                    onBlur={() => {
                      if (field.state.value && field.state.value.length > 0) {
                        const paddedValue = field.state.value.padStart(4, "0");
                        field.handleChange(paddedValue);
                      }
                      field.handleBlur();
                    }}
                  />
                  {field.state.meta.errors &&
                    form.state.isSubmitted &&
                    field.state.meta.errors.length > 0 && (
                      <span className="flex flex-1 w-full justify-center text-center text-base pt-4 text-destructive font-medium">
                        {field.state.meta.errors[0]?.message}
                      </span>
                    )}
                </>
              )}
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          {submissionState.participantId ? (
            <Button
              type="button"
              className="w-full rounded-full py-6 text-lg"
              onClick={handleNextStep}
            >
              {t("participantNumber.continue")}
            </Button>
          ) : (
            <form.Subscribe
              selector={(state) => [
                state.canSubmit,
                state.isSubmitting,
                state.values.participantRef,
              ]}
              children={([canSubmit, isSubmitting, participantRefValue]) => (
                <PrimaryButton
                  type="submit"
                  className="w-full py-3 text-lg rounded-full"
                  disabled={!canSubmit || !participantRefValue}
                >
                  {isSubmitting ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <>
                      <span>{t("participantNumber.continue")}</span>
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </PrimaryButton>
              )}
            />
          )}
        </CardFooter>
      </form>
    </div>
  );
}
