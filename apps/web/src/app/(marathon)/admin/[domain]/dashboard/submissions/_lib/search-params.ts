import {
  createLoader,
  parseAsInteger,
  parseAsStringLiteral,
  parseAsString,
  parseAsArrayOf,
} from "nuqs/server"

export const submissionSearchParams = {
  tab: parseAsStringLiteral([
    "all",
    "initialized",
    "uploaded",
    "not-verified",
    "verified",
    "not-voted",
    "voted",
    "validation-errors",
  ]).withDefault("all"),
  search: parseAsString,
  sortOrder: parseAsStringLiteral(["asc", "desc"]).withDefault("desc"),
  competitionClassId: parseAsArrayOf(parseAsInteger),
  deviceGroupId: parseAsArrayOf(parseAsInteger),
}

export const loadSubmissionSearchParams = createLoader(submissionSearchParams)
