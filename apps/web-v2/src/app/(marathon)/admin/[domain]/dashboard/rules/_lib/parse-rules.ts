import type { RuleConfig } from "@blikka/db"
import { RULE_KEYS } from "@blikka/validation"
import type { RuleKey } from "@blikka/validation"
import {
  allowedFileTypesParamsSchema,
  maxFileSizeParamsSchema,
  RulesFormValues,
  withinTimerangeParamsSchema,
} from "./schemas"

const DEFAULT_RULE_CONFIGS: RulesFormValues = {
  max_file_size: {
    enabled: false,
    severity: "error",
    params: {
      maxBytes: 1024 * 1024 * 5,
    },
  },
  allowed_file_types: {
    enabled: false,
    severity: "error",
    params: {
      allowedFileTypes: ["jpg"],
    },
  },
  within_timerange: {
    enabled: false,
    severity: "error",
    params: {
      start: "",
      end: "",
    },
  },
  same_device: {
    enabled: false,
    severity: "error",
    params: null,
  },
  modified: {
    enabled: false,
    severity: "error",
    params: null,
  },
  strict_timestamp_ordering: {
    enabled: false,
    severity: "error",
    params: null,
  },
}

function parseRuleWithParams<TParams>(
  rule: RuleConfig,
  schema: {
    safeParse: (params: unknown) => { success: boolean; data?: TParams }
  },
  key: keyof RulesFormValues,
  paramOverride?: Partial<TParams>
): Partial<RulesFormValues> {
  if (!rule.params) return {}
  const ok = schema.safeParse(rule.params)
  if (!ok.success) return {}
  return {
    [key]: {
      enabled: rule.enabled,
      severity: rule.severity,
      params: paramOverride ? { ...ok.data, ...paramOverride } : ok.data,
    },
  } as Partial<RulesFormValues>
}

function parseSimpleRule(key: keyof RulesFormValues, rule: RuleConfig): Partial<RulesFormValues> {
  return {
    [key]: {
      enabled: rule.enabled,
      severity: rule.severity,
      params: null,
    },
  }
}

export function parseRules(
  rules: RuleConfig[],
  marathon: { startDate?: string | null; endDate?: string | null }
): RulesFormValues {
  let parsedRules: Partial<RulesFormValues> = {}

  const ruleHandlers: Record<RuleKey, (rule: RuleConfig) => Partial<RulesFormValues>> = {
    [RULE_KEYS.MAX_FILE_SIZE]: (rule) =>
      parseRuleWithParams(rule, maxFileSizeParamsSchema, RULE_KEYS.MAX_FILE_SIZE),
    [RULE_KEYS.ALLOWED_FILE_TYPES]: (rule) =>
      parseRuleWithParams(rule, allowedFileTypesParamsSchema, RULE_KEYS.ALLOWED_FILE_TYPES),
    [RULE_KEYS.WITHIN_TIMERANGE]: (rule) =>
      parseRuleWithParams(rule, withinTimerangeParamsSchema, RULE_KEYS.WITHIN_TIMERANGE, {
        start: marathon.startDate ?? "",
        end: marathon.endDate ?? "",
      }),
    [RULE_KEYS.SAME_DEVICE]: (rule) => parseSimpleRule(RULE_KEYS.SAME_DEVICE, rule),
    [RULE_KEYS.MODIFIED]: (rule) => parseSimpleRule(RULE_KEYS.MODIFIED, rule),
    [RULE_KEYS.STRICT_TIMESTAMP_ORDERING]: (rule) =>
      parseSimpleRule(RULE_KEYS.STRICT_TIMESTAMP_ORDERING, rule),
  }

  for (const rule of rules) {
    const isValidRuleKey = Object.values(RULE_KEYS).includes(rule.ruleKey as RuleKey)
    if (!isValidRuleKey) continue
    const handler = ruleHandlers[rule.ruleKey as RuleKey]
    if (handler) {
      parsedRules = { ...parsedRules, ...handler(rule) }
    }
  }

  const defaultRulesWithMarathonDates = {
    ...DEFAULT_RULE_CONFIGS,
    within_timerange: {
      ...DEFAULT_RULE_CONFIGS.within_timerange,
      params: {
        start: marathon.startDate ?? "",
        end: marathon.endDate ?? "",
      },
    },
  }

  return {
    ...defaultRulesWithMarathonDates,
    ...parsedRules,
  }
}

export function mapRulesToDbRules(rules: RulesFormValues): Array<{
  ruleKey: string
  params?: unknown
  severity?: string
  enabled?: boolean
}> {
  return Object.entries(rules).map(([key, value]) => {
    return {
      ruleKey: key,
      params: value.params,
      enabled: value.enabled,
      severity: value.severity,
    }
  })
}
