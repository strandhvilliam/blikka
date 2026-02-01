"use client";
import { useUploadFlowState } from "../_hooks/use-upload-flow-state";
import { useForm } from "@tanstack/react-form";
import { Button } from "@/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PrimaryButton } from "@/components/ui/primary-button";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Schema } from "effect";
import { useStepState } from "../_lib/step-state-context";
import { type FlowMode } from "../_lib/constants";
import { useState, useEffect } from "react";
import { isPossiblePhoneNumber } from "react-phone-number-input";
import { PhoneInput } from "@/components/ui/phone-input";

function getCountryFromLocale(): string {
  if (typeof navigator === "undefined") return "SE";

  const language = navigator.language;
  if (!language) return "SE";

  // Extract country code from locale (e.g., "en-US" -> "US", "sv-SE" -> "SE")
  const parts = language.split("-");
  if (parts.length > 1) {
    return parts[parts.length - 1].toUpperCase();
  }

  return "SE";
}

const createParticipantDetailsSchema = (
  t: ReturnType<typeof useTranslations>,
  mode: FlowMode,
) => {
  return Schema.standardSchemaV1(
    Schema.Struct({
      firstname: Schema.String.pipe(
        Schema.filter((value) => value.length > 0, {
          message: () => t("participantDetails.firstNameRequired"),
        }),
      ).annotations({
        description: t("participantDetails.firstNameRequired"),
      }),
      lastname: Schema.String.pipe(
        Schema.filter((value) => value.length > 0, {
          message: () => t("participantDetails.lastNameRequired"),
        }),
      ).annotations({
        description: t("participantDetails.lastNameRequired"),
      }),
      email: Schema.String.pipe(
        Schema.filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
          message: () => t("participantDetails.invalidEmail"),
        }),
      ).annotations({ description: t("participantDetails.invalidEmail") }),
      phone:
        mode === "by-camera"
          ? Schema.String.pipe(
              Schema.filter((value) => value.length > 0, {
                message: () => t("participantDetails.phoneRequired"),
              }),
              Schema.filter((value) => isPossiblePhoneNumber(value), {
                message: () => t("participantDetails.invalidPhone"),
              }),
            ).annotations({
              description: t("participantDetails.phoneRequired"),
            })
          : Schema.String,
    }),
  );
};

interface ParticipantDetailsStepProps {
  mode: FlowMode;
}

export function ParticipantDetailsStep({ mode }: ParticipantDetailsStepProps) {
  const t = useTranslations("FlowPage");
  const { uploadFlowState, setUploadFlowState } = useUploadFlowState();
  const { handleNextStep, handlePrevStep } = useStepState();
  const [defaultCountry, setDefaultCountry] = useState<string>("SE");

  useEffect(() => {
    setDefaultCountry(getCountryFromLocale());
  }, []);

  const form = useForm({
    defaultValues: {
      firstname: uploadFlowState.participantFirstName ?? "",
      lastname: uploadFlowState.participantLastName ?? "",
      email: uploadFlowState.participantEmail ?? "",
      phone: uploadFlowState.participantPhone ?? "",
    },
    onSubmit: async ({ value }) => {
      await setUploadFlowState((prev) => ({
        ...prev,
        participantFirstName: value.firstname,
        participantLastName: value.lastname,
        participantEmail: value.email,
        participantPhone: value.phone,
      }));
      handleNextStep();
    },
    validators: {
      onBlur: createParticipantDetailsSchema(t, mode),
    },
  });

  return (
    <div className="max-w-md mx-auto min-h-[70dvh] space-y-10 flex flex-col justify-center">
      <CardHeader className="">
        <CardTitle className="text-2xl font-rocgrotesk font-bold text-center">
          {t("participantDetails.title")}
        </CardTitle>
        <CardDescription className="text-center">
          {t("participantDetails.description")}
        </CardDescription>
      </CardHeader>
      <form onSubmit={(e) => e.preventDefault()}>
        <CardContent className="space-y-6">
          <form.Field
            name="firstname"
            children={(field) => (
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">
                  {t("participantDetails.firstName")}
                </label>
                <Input
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="rounded-xl text-base sm:text-lg py-5 bg-background"
                  placeholder="James"
                />
                {field.state.meta.isTouched &&
                  field.state.meta.errors.length > 0 && (
                    <span className="flex flex-1 w-full justify-center text-sm text-center  text-destructive font-medium">
                      {field.state.meta.errors[0]?.message}
                    </span>
                  )}
              </div>
            )}
          />

          <form.Field
            name="lastname"
            children={(field) => (
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">
                  {t("participantDetails.lastName")}
                </label>
                <Input
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="rounded-xl text-base sm:text-lg py-5 bg-background"
                  placeholder="Bond"
                />
                {field.state.meta.isTouched &&
                  field.state.meta.errors.length > 0 && (
                    <span className="flex flex-1 w-full justify-center text-sm text-center  text-destructive font-medium">
                      {field.state.meta.errors[0]?.message}
                    </span>
                  )}
              </div>
            )}
          />

          <form.Field
            name="email"
            children={(field) => (
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">
                  {t("participantDetails.email")}
                </label>
                <Input
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="rounded-xl text-base sm:text-lg py-5 bg-background"
                  type="email"
                  placeholder="your@email.com"
                />
                {field.state.meta.isTouched &&
                  field.state.meta.errors.length > 0 && (
                    <span className="flex flex-1 w-full justify-center text-sm text-center  text-destructive font-medium">
                      {field.state.meta.errors[0]?.message}
                    </span>
                  )}
              </div>
            )}
          />

          {mode === "by-camera" && (
            <form.Field
              name="phone"
              children={(field) => (
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none">
                    {t("participantDetails.phone")}
                  </label>
                  <PhoneInput
                    defaultCountry={defaultCountry as any}
                    value={field.state.value}
                    onChange={(value) => field.handleChange(value || "")}
                    onBlur={field.handleBlur}
                    international
                    countryCallingCodeEditable={false}
                    className="rounded-xl text-base sm:text-lg bg-background"
                  />
                  {field.state.meta.isTouched &&
                    field.state.meta.errors.length > 0 && (
                      <span className="flex flex-1 w-full justify-center text-sm text-center text-destructive font-medium">
                        {field.state.meta.errors[0]?.message}
                      </span>
                    )}
                </div>
              )}
            />
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-3 pt-8">
          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
            children={([canSubmit]) => (
              <PrimaryButton
                type="button"
                className="w-full py-3.5 text-base sm:text-lg rounded-full"
                disabled={!canSubmit}
                // submit mannually to avoid specific bug when navigating back between steps
                onClick={() => form.handleSubmit()}
              >
                <span>{t("participantDetails.continue")}</span>
                <ArrowRight className="ml-2 h-5 w-5" />
              </PrimaryButton>
            )}
          />
          <Button
            variant="ghost"
            type="button"
            size="lg"
            onClick={handlePrevStep}
            className="w-full"
          >
            {t("participantDetails.back")}
          </Button>
        </CardFooter>
      </form>
    </div>
  );
}
