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
import { Schema } from "effect"

const createParticipantDetailsSchema = (t: ReturnType<typeof useTranslations>) =>
  Schema.standardSchemaV1(Schema.Struct({
    firstname: Schema.String.pipe(
      Schema.minLength(1)
    ).annotations({ description: t("participantDetails.firstNameRequired") }),
    lastname: Schema.String.pipe(
      Schema.minLength(1)
    ).annotations({ description: t("participantDetails.lastNameRequired") }),
    email: Schema.String.pipe(
      Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
    ).annotations({ description: t("participantDetails.invalidEmail") }),
  }));


export function ParticipantDetailsStep({
}) {
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
      firstname: submissionState.participantFirstName ?? "",
      lastname: submissionState.participantLastName ?? "",
      email: submissionState.participantEmail ?? "",
    },
    onSubmit: async ({ value }) => {
      await setSubmissionState((prev) => ({
        ...prev,
        participantFirstName: value.firstname,
        participantLastName: value.lastname,
        participantEmail: value.email,
      }));
      handleNextStep();
    },
    validators: {
      onChange: createParticipantDetailsSchema(t),
      onMount: createParticipantDetailsSchema(t),
    },
  });

  return (
    <div className="max-w-md mx-auto">
      <CardHeader className="space-y-2">
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
                  className="rounded-xl text-lg py-6"
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
                  className="rounded-xl text-lg py-6"
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
                  className="rounded-xl text-lg py-6"
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
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
            children={([canSubmit]) => (
              <PrimaryButton
                type="button"
                className="w-full py-3 text-lg rounded-full"
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
