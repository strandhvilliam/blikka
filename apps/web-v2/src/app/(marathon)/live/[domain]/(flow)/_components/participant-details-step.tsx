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
      onChange: createParticipantDetailsSchema(t, mode),
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
      <form noValidate onSubmit={(e) => e.preventDefault()}>
        <CardContent className="space-y-6">
          <form.Field
            name="firstname"
            children={(field) => {
              const hasError =
                field.state.meta.isTouched &&
                field.state.meta.errors.length > 0;

              return (
                <div className="space-y-2">
                  <label
                    htmlFor={field.name}
                    className="text-sm font-medium leading-none"
                  >
                    {t("participantDetails.firstName")}
                  </label>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    autoComplete="given-name"
                    autoCapitalize="words"
                    enterKeyHint="next"
                    className={`rounded-xl text-base sm:text-lg py-5 bg-background ${
                      hasError
                        ? "border-destructive focus-visible:ring-destructive"
                        : ""
                    }`}
                    aria-invalid={hasError}
                    aria-describedby={
                      hasError ? `${field.name}-error` : undefined
                    }
                    placeholder="James"
                  />
                  {hasError && (
                    <span
                      id={`${field.name}-error`}
                      className="flex flex-1 w-full justify-center text-sm text-center text-destructive font-medium"
                    >
                      {field.state.meta.errors[0]?.message}
                    </span>
                  )}
                </div>
              );
            }}
          />

          <form.Field
            name="lastname"
            children={(field) => {
              const hasError =
                field.state.meta.isTouched &&
                field.state.meta.errors.length > 0;

              return (
                <div className="space-y-2">
                  <label
                    htmlFor={field.name}
                    className="text-sm font-medium leading-none"
                  >
                    {t("participantDetails.lastName")}
                  </label>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    autoComplete="family-name"
                    autoCapitalize="words"
                    enterKeyHint="next"
                    className={`rounded-xl text-base sm:text-lg py-5 bg-background ${
                      hasError
                        ? "border-destructive focus-visible:ring-destructive"
                        : ""
                    }`}
                    aria-invalid={hasError}
                    aria-describedby={
                      hasError ? `${field.name}-error` : undefined
                    }
                    placeholder="Bond"
                  />
                  {hasError && (
                    <span
                      id={`${field.name}-error`}
                      className="flex flex-1 w-full justify-center text-sm text-center text-destructive font-medium"
                    >
                      {field.state.meta.errors[0]?.message}
                    </span>
                  )}
                </div>
              );
            }}
          />

          <form.Field
            name="email"
            children={(field) => {
              const hasError =
                field.state.meta.isTouched &&
                field.state.meta.errors.length > 0;

              return (
                <div className="space-y-2">
                  <label
                    htmlFor={field.name}
                    className="text-sm font-medium leading-none"
                  >
                    {t("participantDetails.email")}
                  </label>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className={`rounded-xl text-base sm:text-lg py-5 bg-background ${
                      hasError
                        ? "border-destructive focus-visible:ring-destructive"
                        : ""
                    }`}
                    aria-invalid={hasError}
                    aria-describedby={
                      hasError ? `${field.name}-error` : undefined
                    }
                    type="email"
                    inputMode="email"
                    enterKeyHint={mode === "by-camera" ? "next" : "done"}
                    placeholder="your@email.com"
                  />
                  {hasError && (
                    <span
                      id={`${field.name}-error`}
                      className="flex flex-1 w-full justify-center text-sm text-center text-destructive font-medium"
                    >
                      {field.state.meta.errors[0]?.message}
                    </span>
                  )}
                </div>
              );
            }}
          />

          {mode === "by-camera" && (
            <form.Field
              name="phone"
              children={(field) => {
                const hasError =
                  field.state.meta.isTouched &&
                  field.state.meta.errors.length > 0;

                return (
                  <div className="space-y-2">
                    <label
                      htmlFor={field.name}
                      className="text-sm font-medium leading-none"
                    >
                      {t("participantDetails.phone")}
                    </label>
                    <PhoneInput
                      id={field.name}
                      name={field.name}
                      defaultCountry={defaultCountry as any}
                      value={field.state.value}
                      onChange={(value) => field.handleChange(value || "")}
                      onBlur={field.handleBlur}
                      autoComplete="tel"
                      inputMode="tel"
                      enterKeyHint="done"
                      international
                      countryCallingCodeEditable={false}
                      className={`rounded-xl text-base sm:text-lg bg-background ${
                        hasError
                          ? "border-destructive focus-visible:ring-destructive"
                          : ""
                      }`}
                      aria-invalid={hasError}
                      aria-describedby={
                        hasError ? `${field.name}-error` : undefined
                      }
                    />
                    {hasError && (
                      <span
                        id={`${field.name}-error`}
                        className="flex flex-1 w-full justify-center text-sm text-center text-destructive font-medium"
                      >
                        {field.state.meta.errors[0]?.message}
                      </span>
                    )}
                  </div>
                );
              }}
            />
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-3 pt-8">
          <form.Subscribe
            selector={(state) => [state.isSubmitting]}
            children={([isSubmitting]) => (
              <PrimaryButton
                type="button"
                className="w-full py-3.5 text-base sm:text-lg rounded-full"
                disabled={isSubmitting}
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
