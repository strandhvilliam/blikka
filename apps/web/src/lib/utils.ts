import { RuleConfig as DbRuleConfig } from "@vimmer/api/db/types"
import { RuleConfig, RuleKey } from "../../../../packages/validation/old/types"
import { createRule } from "@blikka/validation/validator"
import { format } from "date-fns"

export function parseDateFromExif(exif?: Record<string, unknown>) {
  if (!exif) return null
  const dateFields = ["DateTimeOriginal", "CreateDate"].map((field) => exif[field]).filter(Boolean)
  const date = dateFields.at(0)
  if (!date) return null
  const formatted = format(new Date(date as string), "MMM d, yyyy kk:mm")
  return formatted
}

export function formatSubmissionKey({
  ref,
  index,
  domain,
}: {
  domain: string
  ref: string
  index: number
}) {
  const trimmedRef = ref.trim()
  const isOnlyDigits = /^\d+$/.test(trimmedRef)
  const displayRef = isOnlyDigits ? trimmedRef.padStart(4, "0") : trimmedRef
  const displayIndex = (index + 1).toString().padStart(2, "0")
  const fileName = `${displayRef}_${displayIndex}.jpg`
  return `${domain}/${displayRef}/${displayIndex}/${fileName}`
}

export function mapDbRuleConfigsToValidationConfigs(
  dbRuleConfigs: DbRuleConfig[]
): RuleConfig<RuleKey>[] {
  return dbRuleConfigs
    .filter((rule) => rule.enabled)
    .map((rule) => {
      const ruleKey = rule.ruleKey as RuleKey
      const severity = rule.severity as "error" | "warning"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return createRule(ruleKey, severity, rule.params as any)
    })
}

export function isImageFile(filename: string): boolean {
  return /\.(jpg|jpeg|png|webp|gif)$/i.test(filename)
}

export function getMimeTypeFromExtension(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase()
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg"
    case "png":
      return "image/png"
    case "webp":
      return "image/webp"
    case "gif":
      return "image/gif"
    default:
      return "image/jpeg"
  }
}

export function truncate(str: string, options: { length?: number } = {}) {
  const { length = 30 } = options
  if (str.length <= length) return str
  return str.slice(0, length - 3) + "..."
}
