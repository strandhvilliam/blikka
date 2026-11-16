import { type ReactNode, useId, useState } from "react";
import { Button } from "@ui-sdk/react/button";
import { Progress, ProgressIndicator, ProgressTrack } from "@ui-sdk/react/progress";

export function Steps({ progress: [step, of] }: { progress: [step: number, of: number] }) {
  return (
    <Progress
      aria-label="Setup"
      value={step}
      max={of}
      format={(value) => `Step ${value} of ${of}`}
      className="self-center"
    >
      <ProgressTrack>
        <ProgressIndicator />
      </ProgressTrack>
    </Progress>
  );
}

// One question, centered. `children` gets the question's id to label its fields with. `submit`
// returns an error message, or nothing once it has moved on.
export function Step({
  greeting,
  question,
  hint,
  progress,
  back,
  action = "Continue",
  complete,
  error: initialError,
  submit,
  children,
}: {
  greeting?: string;
  question: string;
  hint: ReactNode;
  progress?: [step: number, of: number];
  back?: () => void;
  action?: string;
  complete: boolean;
  // Shown until the next submit, for an error found on a later step.
  error?: string;
  submit: () => Promise<string | void> | string | void;
  children: (labelId: string) => ReactNode;
}) {
  const id = useId();
  const [error, setError] = useState(initialError);
  // Stays set after success too, so a second click while moving on can't submit twice.
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      className="flex w-full max-w-sm flex-col gap-6 text-center"
      onSubmit={async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(undefined);
        const error = await submit();

        if (error) {
          setError(error);
          setSubmitting(false);
        }
      }}
    >
      {progress && <Steps progress={progress} />}
      <div className="flex flex-col gap-2">
        {greeting && <p className="text-muted-foreground">{greeting}</p>}
        <h1 id={id} className="text-2xl font-semibold">
          {question}
        </h1>
        <p className="text-sm text-balance text-muted-foreground">{hint}</p>
      </div>
      {children(id)}
      <div className="flex flex-col gap-2">
        <Button type="submit" data-variant="solid" disabled={submitting || !complete}>
          {action}
        </Button>
        {back && (
          <Button disabled={submitting} onClick={back}>
            Back
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
