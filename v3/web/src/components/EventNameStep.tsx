import { IconLink } from "@tabler/icons-react";
import { Input } from "@ui-sdk/react/input";
import { Step } from "@/components/Step.tsx";
import { slugOf } from "@/lib/slug.ts";

export function EventNameStep({
  value,
  onChange,
  progress,
  submit,
}: {
  value: string;
  onChange: (name: string) => void;
  progress: [step: number, of: number];
  submit: () => Promise<string | void>;
}) {
  return (
    <Step
      question="What's the event called?"
      hint="Participants see it, and the event's link is made from it."
      progress={progress}
      complete={!!value.trim()}
      submit={submit}
    >
      {(labelId) => (
        <div className="flex flex-col gap-2">
          <Input
            aria-labelledby={labelId}
            autoFocus
            autoComplete="off"
            placeholder="Summer Photo Walk"
            required
            maxLength={100}
            value={value}
            onValueChange={onChange}
          />
          {value.trim() && (
            <p className="flex min-w-0 items-center justify-center gap-1.5 text-sm text-muted-foreground">
              <IconLink aria-hidden className="size-4 shrink-0" />
              <span className="sr-only">Link:</span>
              <span className="truncate">/e/{slugOf(value)}</span>
            </p>
          )}
        </div>
      )}
    </Step>
  );
}
