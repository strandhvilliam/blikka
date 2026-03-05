export type SubmissionTab =
  | "all"
  | "initialized"
  | "not-verified"
  | "verified"
  | "validation-errors"

export interface TabQueryParams {
  statusFilter: "completed" | "verified" | null
  excludeStatuses: string[] | null
  hasValidationErrors: boolean | null
}

export function getTabQueryParams(activeTab: SubmissionTab): TabQueryParams {
  switch (activeTab) {
    case "all":
      return {
        statusFilter: null,
        excludeStatuses: null,
        hasValidationErrors: null,
      }
    case "initialized":
      return {
        statusFilter: null,
        excludeStatuses: ["completed", "verified"],
        hasValidationErrors: null,
      }
    case "not-verified":
      return {
        statusFilter: "completed",
        excludeStatuses: null,
        hasValidationErrors: null,
      }
    case "verified":
      return {
        statusFilter: "verified",
        excludeStatuses: null,
        hasValidationErrors: null,
      }
    case "validation-errors":
      return {
        statusFilter: null,
        excludeStatuses: null,
        hasValidationErrors: true,
      }
    default:
      return {
        statusFilter: null,
        excludeStatuses: null,
        hasValidationErrors: null,
      }
  }
}

/** Normalize array param: empty → undefined, single → keep as array for API */
export function normalizeIdArray(
  ids: number[] | null | undefined,
): number[] | undefined {
  if (!ids || ids.length === 0) return undefined
  return ids
}
