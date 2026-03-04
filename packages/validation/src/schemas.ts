import { Schema, Struct } from "effect"
import { IMAGE_EXTENSION_TO_MIME_TYPE, RULE_KEYS, VALIDATION_OUTCOME } from "./constants"
import type { RuleKey } from "./types"

export const SeverityLevelSchema = Schema.Literals(["error", "warning"])

export const RuleKeySchema = Schema.Literals([
  RULE_KEYS.MAX_FILE_SIZE,
  RULE_KEYS.ALLOWED_FILE_TYPES,
  RULE_KEYS.WITHIN_TIMERANGE,
  RULE_KEYS.STRICT_TIMESTAMP_ORDERING,
  RULE_KEYS.SAME_DEVICE,
  RULE_KEYS.MODIFIED]
)


export const RuleParamsSchema = Schema.Struct({
  [RULE_KEYS.ALLOWED_FILE_TYPES]: Schema.Struct({
    allowedFileTypes: Schema.Array(
      Schema.String.pipe(
        Schema.check(Schema.makeFilter((ext) => ext in IMAGE_EXTENSION_TO_MIME_TYPE, {
          message: "Invalid file extension",
        }))
      )
    ),
  }),
  [RULE_KEYS.MAX_FILE_SIZE]: Schema.Struct({
    maxBytes: Schema.Number.check(Schema.isGreaterThan(0), Schema.isInt()),
  }),
  [RULE_KEYS.WITHIN_TIMERANGE]: Schema.Struct({
    start: Schema.String,
    end: Schema.String,
  }),
  [RULE_KEYS.STRICT_TIMESTAMP_ORDERING]: Schema.NullOr(Schema.Struct({})),
  [RULE_KEYS.SAME_DEVICE]: Schema.NullOr(Schema.Struct({})),
  [RULE_KEYS.MODIFIED]: Schema.NullOr(Schema.Struct({})),
})

export const ValidationRuleSchema = <K extends RuleKey>(key: K) =>
  Schema.Struct({
    ruleKey: RuleKeySchema,
    enabled: Schema.Boolean,
    severity: SeverityLevelSchema,
    params: RuleParamsSchema.mapFields(Struct.pick([key])),
  })

export const ValidationConfigSchema = Schema.Struct({
  rules: Schema.Array(
    Schema.Union([
      ValidationRuleSchema(RULE_KEYS.MAX_FILE_SIZE),
      ValidationRuleSchema(RULE_KEYS.ALLOWED_FILE_TYPES),
      ValidationRuleSchema(RULE_KEYS.WITHIN_TIMERANGE),
      ValidationRuleSchema(RULE_KEYS.STRICT_TIMESTAMP_ORDERING),
      ValidationRuleSchema(RULE_KEYS.SAME_DEVICE),
      ValidationRuleSchema(RULE_KEYS.MODIFIED)
    ])
  ).check(Schema.isMinLength(1)),
  stopOnFirstError: Schema.Boolean,
  parallelExecution: Schema.Boolean,
})

export const ExifDataSchema = Schema.Record(
  Schema.String,
  Schema.Any,
)

export const ValidationInputSchema = Schema.Struct({
  exif: ExifDataSchema,
  fileName: Schema.String.check(Schema.isMinLength(1)),
  fileSize: Schema.Number.check(Schema.isGreaterThan(0), Schema.isInt()),
  orderIndex: Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  mimeType: Schema.String,
})

export const ValidationResultSchema = Schema.Struct({
  outcome: Schema.Literals([
    VALIDATION_OUTCOME.PASSED,
    VALIDATION_OUTCOME.FAILED,
    VALIDATION_OUTCOME.SKIPPED
  ]),
  ruleKey: RuleKeySchema,
  message: Schema.String,
  severity: SeverityLevelSchema,
  fileName: Schema.optional(Schema.String),
  orderIndex: Schema.optional(Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0))),
  isGeneral: Schema.Boolean,
})
