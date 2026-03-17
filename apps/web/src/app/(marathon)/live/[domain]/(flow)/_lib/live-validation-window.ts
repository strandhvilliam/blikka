import type { Topic } from "@blikka/db";

export interface LiveValidationWindow {
  validationStartDate?: string | null;
  validationEndDate?: string | null;
}

export function getMarathonValidationWindow({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}): LiveValidationWindow {
  return {
    validationStartDate: startDate,
    validationEndDate: endDate,
  };
}

export function getByCameraValidationWindow(
  topic: Pick<Topic, "scheduledStart" | "scheduledEnd"> | null,
): LiveValidationWindow {
  return {
    validationStartDate: topic?.scheduledStart ?? null,
    validationEndDate: topic?.scheduledEnd ?? null,
  };
}
