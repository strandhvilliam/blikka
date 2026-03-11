"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStaffUploadStep } from "../_hooks/use-staff-upload-step";

const STEPS = [
  { key: "find", label: "Find" },
  { key: "select", label: "Select" },
  { key: "upload", label: "Upload" },
  { key: "done", label: "Done" },
] as const;

const FLOW_STEP_TO_INDEX: Record<string, number> = {
  reference: 0,
  details: 0,
  upload: 1,
  progress: 2,
  complete: 3,
};

export function StepIndicator() {
  const [currentFlowStep] = useStaffUploadStep();
  const currentIndex = FLOW_STEP_TO_INDEX[currentFlowStep] ?? 0;

  return (
    <nav className="flex items-center" aria-label="Progress">
      {STEPS.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <div key={step.key} className="flex items-center">
            {index > 0 && (
              <div
                className={cn(
                  "h-px w-6 sm:w-10",
                  isCompleted ? "bg-emerald-400" : "bg-border",
                )}
              />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition-colors duration-200",
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
              <span
                className={cn(
                  "hidden text-[10px] font-semibold uppercase tracking-[0.14em] sm:block",
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
          </div>
        );
      })}
    </nav>
  );
}
