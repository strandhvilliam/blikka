"use client";

import { Fragment } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStaffUploadStep } from "@/hooks/staff/use-staff-upload-step";

const STEPS = [
  { key: "find", label: "Find" },
  { key: "select", label: "Select" },
  { key: "upload", label: "Upload" },
  { key: "done", label: "Done" },
] as const;

const FLOW_STEP_TO_INDEX: Record<string, number> = {
  phone: 0,
  reference: 0,
  details: 0,
  upload: 1,
  progress: 2,
  complete: 3,
};

const CONNECTOR_CLASS = "w-6 shrink-0 sm:w-10";

export function StepIndicator() {
  const [currentFlowStep] = useStaffUploadStep();
  const currentIndex = FLOW_STEP_TO_INDEX[currentFlowStep] ?? 0;

  return (
    <nav className="flex flex-col items-center gap-1" aria-label="Progress">
      <div className="flex w-full items-center">
        {STEPS.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const lineDone = index < currentIndex;

          return (
            <Fragment key={`${step.key}-circles`}>
              <div className="flex min-w-0 flex-1 justify-center">
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors duration-200",
                    isCompleted && "bg-emerald-500 text-white",
                    isCurrent && "bg-foreground text-background shadow-sm",
                    !isCurrent && !isCompleted && "bg-muted text-muted-foreground",
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                  ) : (
                    index + 1
                  )}
                </div>
              </div>
              {index < STEPS.length - 1 ? (
                <div
                  className={cn(
                    "h-px self-center",
                    CONNECTOR_CLASS,
                    lineDone ? "bg-emerald-400" : "bg-border",
                  )}
                  aria-hidden
                />
              ) : null}
            </Fragment>
          );
        })}
      </div>
      <div className="hidden w-full items-start sm:flex">
        {STEPS.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <Fragment key={`${step.key}-labels`}>
              <div className="flex min-w-0 flex-1 justify-center">
                <span
                  className={cn(
                    "text-center text-[10px] font-semibold uppercase tracking-[0.14em]",
                    isCurrent
                      ? "text-foreground"
                      : isCompleted
                        ? "text-emerald-600"
                        : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
              </div>
              {index < STEPS.length - 1 ? (
                <div className={CONNECTOR_CLASS} aria-hidden />
              ) : null}
            </Fragment>
          );
        })}
      </div>
    </nav>
  );
}
