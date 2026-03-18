"use client";
import { useUploadFlowState } from "../_hooks/use-upload-flow-state";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
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
import { ArrowRight, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { useStepState } from "../_lib/step-state-context";
import { type FlowMode } from "../_lib/constants";
import { useEffect, useRef, useState } from "react";
import {
  isPossiblePhoneNumber,
  parsePhoneNumber,
} from "react-phone-number-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { useTRPC } from "@/lib/trpc/client";
import { useDomain } from "@/lib/domain-provider";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toParticipantFlowStatePatch } from "../_lib/upload-flow-state";

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
    firstname: z.string().min(1, t("participantDetails.firstNameRequired")),
    lastname: z.string().min(1, t("participantDetails.lastNameRequired")),
    email: z.string().email(t("participantDetails.invalidEmail")),
    phone:
      mode === "by-camera"
        ? z
            .string()
            .min(1, t("participantDetails.phoneRequired"))
            .refine(isPossiblePhoneNumber, t("participantDetails.invalidPhone"))
        : z.string(),
  });

const createParticipantDetailsValidator =
  (t: ReturnType<typeof useTranslations>, mode: FlowMode) =>
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
type ParticipantDetailsValues = {
  firstname: string;
  lastname: string;
  email: string;
  phone: string;
};

export function ParticipantDetailsStep({ mode }: ParticipantDetailsStepProps) {
  const t = useTranslations("FlowPage");
  const { uploadFlowState, setUploadFlowState } = useUploadFlowState();
  const { handleNextStep, handlePrevStep } = useStepState();
  const domain = useDomain();
  const trpc = useTRPC();
  const [focusedField, setFocusedField] =
    useState<ParticipantDetailsFieldName | null>(null);
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);
  const [pendingReplacement, setPendingReplacement] = useState<{
    values: ParticipantDetailsValues;
    participantId: number;
    reference: string;
  } | null>(null);
  const [isCheckingParticipant, setIsCheckingParticipant] = useState(false);
  const isCheckingParticipantRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const defaultCountry = getCountryFromLocale();
  const resolveByCameraParticipantByPhone = useMutation(
    trpc.uploadFlow.resolveByCameraParticipantByPhone.mutationOptions(),
  );
  const isByCameraLookupPending =
    mode === "by-camera" &&
    (isCheckingParticipant || resolveByCameraParticipantByPhone.isPending);

  const persistByCameraParticipant = async ({
    values,
    participantId,
    reference,
    replaceExistingActiveTopicUpload,
  }: {
    values: ParticipantDetailsValues;
    participantId: number | null;
    reference: string | null;
    replaceExistingActiveTopicUpload: boolean | null;
  }) => {
    await setUploadFlowState((prev) => ({
      ...prev,
      ...toParticipantFlowStatePatch(values, {
        participantId,
        participantRef: reference,
        replaceExistingActiveTopicUpload,
      }),
    }));
  };

  const handleConfirmReplacement = async () => {
    if (!pendingReplacement) return;

    await persistByCameraParticipant({
      values: pendingReplacement.values,
      participantId: pendingReplacement.participantId,
      reference: pendingReplacement.reference,
      replaceExistingActiveTopicUpload: true,
    });
    setReplaceDialogOpen(false);
    setPendingReplacement(null);
    handleNextStep();
  };

  const form = useForm({
    defaultValues: {
      firstname: uploadFlowState.participantFirstName ?? "",
      lastname: uploadFlowState.participantLastName ?? "",
      email: uploadFlowState.participantEmail ?? "",
      phone: uploadFlowState.participantPhone ?? "",
    },
    onSubmit: async ({ value }) => {
      if (mode === "by-camera") {
        if (isCheckingParticipantRef.current) {
          return;
        }

        isCheckingParticipantRef.current = true;
        setIsCheckingParticipant(true);

        try {
          const resolution =
            await resolveByCameraParticipantByPhone.mutateAsync({
              domain,
              phoneNumber: value.phone,
            });

          if (
            resolution.match &&
            resolution.activeTopicUploadState === "already-uploaded"
          ) {
            setPendingReplacement({
              values: value,
              participantId: resolution.participantId,
              reference: resolution.reference,
            });
            setReplaceDialogOpen(true);
            return;
          }

          await persistByCameraParticipant({
            values: value,
            participantId: resolution.match ? resolution.participantId : null,
            reference: resolution.match ? resolution.reference : null,
            replaceExistingActiveTopicUpload: null,
          });
          handleNextStep();
          return;
        } catch (error) {
          console.error(error);
          toast.error(t("participantDetails.resolveError"));
          return;
        } finally {
          isCheckingParticipantRef.current = false;

          if (isMountedRef.current) {
            setIsCheckingParticipant(false);
          }
        }
      }

      await setUploadFlowState((prev) => ({
        ...prev,
        ...toParticipantFlowStatePatch(value, { trimPhone: true }),
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
      <AlertDialog
        open={replaceDialogOpen}
        onOpenChange={(open) => {
          setReplaceDialogOpen(open);
          if (!open) {
            setPendingReplacement(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("participantDetails.replaceExistingTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("participantDetails.replaceExistingDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("participantDetails.replaceExistingCancel")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmReplacement()}>
              {t("participantDetails.replaceExistingConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
          <form.Subscribe
            selector={(state: { submissionAttempts: number }) =>
              state.submissionAttempts
            }
          >
            {(submissionAttempts) => (
              <>
                <form.Field name="firstname">
                  {(field) => {
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
                          disabled={isByCameraLookupPending}
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
                </form.Field>

                <form.Field name="lastname">
                  {(field) => {
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
                          disabled={isByCameraLookupPending}
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
                </form.Field>

                <form.Field name="email">
                  {(field) => {
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
                          disabled={isByCameraLookupPending}
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
                </form.Field>

                {mode === "by-camera" && (
                  <form.Field name="phone">
                    {(field) => {
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
                            disabled={isByCameraLookupPending}
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
                  </form.Field>
                )}
              </>
            )}
          </form.Subscribe>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 pt-8">
          <form.Subscribe
            selector={(state: { isSubmitting: boolean }) => [
              state.isSubmitting,
            ]}
          >
            {([isSubmitting]) => (
              <PrimaryButton
                type="button"
                className="w-full py-3.5 text-base sm:text-lg rounded-full"
                disabled={
                  isSubmitting || isByCameraLookupPending
                }
                // submit mannually to avoid specific bug when navigating back between steps
                onClick={() => form.handleSubmit()}
              >
                {isByCameraLookupPending ? (
                  <>
                    <Loader2 className="animate-spin" />
                    <span>{t("participantDetails.checking")}</span>
                  </>
                ) : (
                  <>
                    <span>{t("participantDetails.continue")}</span>
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </PrimaryButton>
            )}
          </form.Subscribe>
          <Button
            variant="ghost"
            type="button"
            size="lg"
            onClick={handlePrevStep}
            className="w-full"
            disabled={isByCameraLookupPending}
          >
            {t("participantDetails.back")}
          </Button>
        </CardFooter>
      </form>
    </div>
  );
}
