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
import { z } from "zod";
import { useStepState } from "../_lib/step-state-context";
import { type FlowMode } from "../_lib/constants";
import { useState, useEffect } from "react";
import {
  isPossiblePhoneNumber,
  parsePhoneNumber,
} from "react-phone-number-input";
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
) =>
  z.object({
    firstname: z
      .string()
      .min(1, t("participantDetails.firstNameRequired")),
    lastname: z
      .string()
      .min(1, t("participantDetails.lastNameRequired")),
    email: z
      .string()
      .email(t("participantDetails.invalidEmail")),
    phone:
      mode === "by-camera"
        ? z
            .string()
            .min(1, t("participantDetails.phoneRequired"))
            .refine(isPossiblePhoneNumber, t("participantDetails.invalidPhone"))
        : z.string(),
  });

const createParticipantDetailsValidator = (
  t: ReturnType<typeof useTranslations>,
  mode: FlowMode,
) =>
  ({
    value,
  }: {
    value: {
      firstname: string;
      lastname: string;
      email: string;
      phone: string;
    };
  }) => {
    const result = createParticipantDetailsSchema(t, mode).safeParse(value);
    if (result.success) return undefined;
    const fieldErrors = result.error.flatten().fieldErrors;
    return {
      fields: {
        firstname: fieldErrors.firstname?.[0],
        lastname: fieldErrors.lastname?.[0],
        email: fieldErrors.email?.[0],
        phone: fieldErrors.phone?.[0],
      },
    };
  };

interface ParticipantDetailsStepProps {
  mode: FlowMode;
}

type ParticipantDetailsFieldName = "firstname" | "lastname" | "email" | "phone";

export function ParticipantDetailsStep({ mode }: ParticipantDetailsStepProps) {
  const t = useTranslations("FlowPage");
  const { uploadFlowState, setUploadFlowState } = useUploadFlowState();
  const { handleNextStep, handlePrevStep } = useStepState();
  const [defaultCountry, setDefaultCountry] = useState<string>("SE");
  const [focusedField, setFocusedField] =
    useState<ParticipantDetailsFieldName | null>(null);

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
      onChange: createParticipantDetailsValidator(t, mode),
      onBlur: createParticipantDetailsValidator(t, mode),
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
          <form.Subscribe selector={(state) => state.submissionAttempts}>
            {(submissionAttempts) => (
              <>
                <form.Field
                  name="firstname"
                  children={(field) => {
                    const hasValidationError =
                      field.state.meta.errors.length > 0;
                    const showError =
                      hasValidationError &&
                      (field.state.meta.isBlurred ||
                        (submissionAttempts > 0 &&
                          focusedField !==
                            (field.name as ParticipantDetailsFieldName)));

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
                          onFocus={() =>
                            setFocusedField(
                              field.name as ParticipantDetailsFieldName,
                            )
                          }
                          onBlur={() => {
                            field.handleBlur();
                            setFocusedField((prev) =>
                              prev === field.name ? null : prev,
                            );
                          }}
                          onChange={(e) => field.handleChange(e.target.value)}
                          autoComplete="given-name"
                          autoCapitalize="words"
                          enterKeyHint="next"
                          className={`rounded-xl text-base sm:text-lg py-5 bg-background ${
                            showError
                              ? "border-destructive focus-visible:ring-destructive"
                              : ""
                          }`}
                          aria-invalid={showError}
                          aria-describedby={
                            showError ? `${field.name}-error` : undefined
                          }
                          placeholder="James"
                        />
                        {showError && (
                          <span
                            id={`${field.name}-error`}
                            className="flex flex-1 w-full justify-center text-sm text-center text-destructive font-medium"
                          >
                            {field.state.meta.errors[0]}
                          </span>
                        )}
                      </div>
                    );
                  }}
                />

                <form.Field
                  name="lastname"
                  children={(field) => {
                    const hasValidationError =
                      field.state.meta.errors.length > 0;
                    const showError =
                      hasValidationError &&
                      (field.state.meta.isBlurred ||
                        (submissionAttempts > 0 &&
                          focusedField !==
                            (field.name as ParticipantDetailsFieldName)));

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
                          onFocus={() =>
                            setFocusedField(
                              field.name as ParticipantDetailsFieldName,
                            )
                          }
                          onBlur={() => {
                            field.handleBlur();
                            setFocusedField((prev) =>
                              prev === field.name ? null : prev,
                            );
                          }}
                          onChange={(e) => field.handleChange(e.target.value)}
                          autoComplete="family-name"
                          autoCapitalize="words"
                          enterKeyHint="next"
                          className={`rounded-xl text-base sm:text-lg py-5 bg-background ${
                            showError
                              ? "border-destructive focus-visible:ring-destructive"
                              : ""
                          }`}
                          aria-invalid={showError}
                          aria-describedby={
                            showError ? `${field.name}-error` : undefined
                          }
                          placeholder="Bond"
                        />
                        {showError && (
                          <span
                            id={`${field.name}-error`}
                            className="flex flex-1 w-full justify-center text-sm text-center text-destructive font-medium"
                          >
                            {field.state.meta.errors[0]}
                          </span>
                        )}
                      </div>
                    );
                  }}
                />

                <form.Field
                  name="email"
                  children={(field) => {
                    const hasValidationError =
                      field.state.meta.errors.length > 0;
                    const showError =
                      hasValidationError &&
                      (field.state.meta.isBlurred ||
                        (submissionAttempts > 0 &&
                          focusedField !==
                            (field.name as ParticipantDetailsFieldName)));

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
                          onFocus={() =>
                            setFocusedField(
                              field.name as ParticipantDetailsFieldName,
                            )
                          }
                          onBlur={() => {
                            field.handleBlur();
                            setFocusedField((prev) =>
                              prev === field.name ? null : prev,
                            );
                          }}
                          onChange={(e) => field.handleChange(e.target.value)}
                          autoComplete="email"
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          className={`rounded-xl text-base sm:text-lg py-5 bg-background ${
                            showError
                              ? "border-destructive focus-visible:ring-destructive"
                              : ""
                          }`}
                          aria-invalid={showError}
                          aria-describedby={
                            showError ? `${field.name}-error` : undefined
                          }
                          type="email"
                          inputMode="email"
                          enterKeyHint={mode === "by-camera" ? "next" : "done"}
                          placeholder="your@email.com"
                        />
                        {showError && (
                          <span
                            id={`${field.name}-error`}
                            className="flex flex-1 w-full justify-center text-sm text-center text-destructive font-medium"
                          >
                            {field.state.meta.errors[0]}
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
                      const hasValidationError =
                        field.state.meta.errors.length > 0;
                      const isPhoneFieldFocused =
                        focusedField ===
                        (field.name as ParticipantDetailsFieldName);
                      const hasEnteredNationalDigits = !!parsePhoneNumber(
                        field.state.value,
                      )?.nationalNumber;
                      const showError =
                        hasValidationError &&
                        !isPhoneFieldFocused &&
                        (submissionAttempts > 0 ||
                          (field.state.meta.isBlurred &&
                            hasEnteredNationalDigits));

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
                            onChange={(value) =>
                              field.handleChange(value || "")
                            }
                            onFocus={() =>
                              setFocusedField(
                                field.name as ParticipantDetailsFieldName,
                              )
                            }
                            onBlur={() => {
                              field.handleBlur();
                              setFocusedField((prev) =>
                                prev === field.name ? null : prev,
                              );
                            }}
                            autoComplete="tel"
                            inputMode="tel"
                            enterKeyHint="done"
                            international
                            countryCallingCodeEditable={false}
                            className={`rounded-xl text-base sm:text-lg bg-background ${
                              showError
                                ? "border-destructive focus-visible:ring-destructive"
                                : ""
                            }`}
                            aria-invalid={showError}
                            aria-describedby={
                              showError ? `${field.name}-error` : undefined
                            }
                          />
                          {showError && (
                            <span
                              id={`${field.name}-error`}
                              className="flex flex-1 w-full justify-center text-sm text-center text-destructive font-medium"
                            >
                              {field.state.meta.errors[0]}
                            </span>
                          )}
                        </div>
                      );
                    }}
                  />
                )}
              </>
            )}
          </form.Subscribe>
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
