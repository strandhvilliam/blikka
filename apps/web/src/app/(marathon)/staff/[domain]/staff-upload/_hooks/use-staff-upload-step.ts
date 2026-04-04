"use client";

import { parseAsStringEnum, useQueryState } from "nuqs";

export const STAFF_UPLOAD_STEPS = [
  "phone",
  "reference",
  "details",
  "upload",
  "progress",
  "complete",
] as const;

export type StaffUploadStep = (typeof STAFF_UPLOAD_STEPS)[number];

const staffUploadStepParser = parseAsStringEnum([...STAFF_UPLOAD_STEPS])
  .withDefault("reference")
  .withOptions({ history: "push" });

export function useStaffUploadStep() {
  return useQueryState("s", staffUploadStepParser);
}
