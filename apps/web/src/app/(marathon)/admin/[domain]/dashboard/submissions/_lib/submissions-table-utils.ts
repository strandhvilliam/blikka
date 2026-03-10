export type SubmissionTab =
  | "all"
  | "prepared"
  | "initialized"
  | "uploaded"
  | "not-verified"
  | "verified"
  | "not-voted"
  | "voted"
  | "validation-errors";

export interface TabQueryParams {
  statusFilter: "completed" | "verified" | null;
  excludeStatuses: string[] | null;
  includeStatuses: string[] | null;
  hasValidationErrors: boolean | null;
  votedFilter: "voted" | "not-voted" | null;
}

export function getTabQueryParams(activeTab: SubmissionTab): TabQueryParams {
  switch (activeTab) {
    case "all":
      return {
        statusFilter: null,
        excludeStatuses: null,
        includeStatuses: null,
        hasValidationErrors: null,
        votedFilter: null,
      };
    case "prepared":
      return {
        statusFilter: null,
        excludeStatuses: null,
        includeStatuses: ["prepared"],
        hasValidationErrors: null,
        votedFilter: null,
      };
    case "initialized":
      return {
        statusFilter: null,
        excludeStatuses: null,
        includeStatuses: ["initialized"],
        hasValidationErrors: null,
        votedFilter: null,
      };
    case "uploaded":
      return {
        statusFilter: null,
        excludeStatuses: null,
        includeStatuses: ["completed", "verified"],
        hasValidationErrors: null,
        votedFilter: null,
      };
    case "not-verified":
      return {
        statusFilter: "completed",
        excludeStatuses: null,
        includeStatuses: null,
        hasValidationErrors: null,
        votedFilter: null,
      };
    case "verified":
      return {
        statusFilter: "verified",
        excludeStatuses: null,
        includeStatuses: null,
        hasValidationErrors: null,
        votedFilter: null,
      };
    case "not-voted":
      return {
        statusFilter: null,
        excludeStatuses: null,
        includeStatuses: null,
        hasValidationErrors: null,
        votedFilter: "not-voted",
      };
    case "voted":
      return {
        statusFilter: null,
        excludeStatuses: null,
        includeStatuses: null,
        hasValidationErrors: null,
        votedFilter: "voted",
      };
    case "validation-errors":
      return {
        statusFilter: null,
        excludeStatuses: null,
        includeStatuses: null,
        hasValidationErrors: true,
        votedFilter: null,
      };
    default:
      return {
        statusFilter: null,
        excludeStatuses: null,
        includeStatuses: null,
        hasValidationErrors: null,
        votedFilter: null,
      };
  }
}

/** Normalize array param: empty → undefined, single → keep as array for API */
export function normalizeIdArray(
  ids: number[] | null | undefined,
): number[] | undefined {
  if (!ids || ids.length === 0) return undefined;
  return ids;
}
