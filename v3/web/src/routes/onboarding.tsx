import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useId, useState } from "react";
import { api } from "../api.ts";
import { authClient } from "../authClient.ts";
import { Button } from "../components/ui/Button.tsx";
import { Input } from "../components/ui/Input.tsx";
import { sessionQuery } from "../session.ts";

export const Route = createFileRoute("/onboarding")({
  beforeLoad: ({ context }) => {
    if (!context.session) throw redirect({ to: "/login" });
    return { session: context.session };
  },
  component: Onboarding,
});

function Onboarding() {
  const { session } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Email-code sign-ups start with an empty name; Google sign-ups bring theirs and skip the step.
  const [step, setStep] = useState(session.user.name.trim() ? "organization" : "name");

  return step === "name" ? (
    <Step
      key="name"
      question="What's your name?"
      autoComplete="name"
      submit={async (name) => {
        const { error } = await authClient.updateUser({ name });
        if (error) return `Could not save your name: ${error.message}`;
        await queryClient.invalidateQueries({ queryKey: sessionQuery.queryKey });
        setStep("organization");
      }}
    />
  ) : (
    <Step
      key="organization"
      question="What's your organization called?"
      autoComplete="organization"
      submit={async (name) => {
        const { data, response } = await api().POST("/organizations", { body: { name } });
        if (!data) return `Could not create the organization: ${response.status}`;
        await navigate({ to: "/dashboard/$organizationId", params: { organizationId: data.id } });
      }}
    />
  );
}

// One question, centered, with the keyboard up. `submit` gets the trimmed answer and returns an
// error message, or nothing once it has moved on.
function Step({
  question,
  autoComplete,
  submit,
}: {
  question: string;
  autoComplete: string;
  submit: (value: string) => Promise<string | void>;
}) {
  const id = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string>();
  // Stays set after success too, so a second click while moving on can't submit twice.
  const [submitting, setSubmitting] = useState(false);

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <form
        className="flex w-full max-w-sm flex-col gap-6 text-center"
        onSubmit={async (e) => {
          e.preventDefault();
          setSubmitting(true);
          const error = await submit(value.trim());
          if (error) {
            setError(error);
            setSubmitting(false);
          }
        }}
      >
        <h1 id={id} className="text-2xl font-semibold">
          {question}
        </h1>
        <Input
          aria-labelledby={id}
          autoFocus
          autoComplete={autoComplete}
          required
          maxLength={100}
          className="h-12 text-center text-lg md:text-lg"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button type="submit" size="lg" className="h-12" disabled={submitting || !value.trim()}>
          Continue
        </Button>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </form>
    </main>
  );
}
