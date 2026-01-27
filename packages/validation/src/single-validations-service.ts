import { Effect, Option } from "effect"
import type { RuleParams, ValidationInput } from "./types"
import {
  RULE_KEYS,
  IMAGE_EXTENSION_TO_MIME_TYPE,
  EDITING_SOFTWARE_KEYWORDS,
} from "./constants"
import { getTimestamp, getExtensionFromFilename } from "./utils"
import { ValidationFailure, ValidationSkipped } from "./types"

export class SingleValidationsService extends Effect.Service<SingleValidationsService>()(
  "@blikka/packages/validation/SingleValidationsService",
  {
    effect: Effect.gen(function*() {
      const validateMaxFileSize = (
        params: RuleParams["max_file_size"],
        input: ValidationInput
      ) =>
        Effect.gen(function*() {
          if (input.fileSize > params.maxBytes) {
            return yield* new ValidationFailure({
              ruleKey: RULE_KEYS.MAX_FILE_SIZE,
              message: `File size is too large: ${Math.round(input.fileSize / 1024 / 1024)} mb (max ${Math.round(params.maxBytes / 1024 / 1024)} mb)`,
              context: {
                fileSize: input.fileSize,
                maxBytes: params.maxBytes,
              },
            })
          }

          return yield* Effect.succeed(void 0)
        })
      const validateAllowedFileTypes = (
        params: RuleParams["allowed_file_types"],
        input: ValidationInput
      ) =>
        Effect.gen(function*() {
          const extension = getExtensionFromFilename(input.fileName)

          const parsedAllowedFileTypes = params.allowedFileTypes.reduce(
            (acc, curr) => {
              if (curr === "jpeg") {
                acc.push("jpg")
              }
              acc.push(curr)
              return acc
            },
            [] as string[]
          )

          if (Option.isNone(extension)) {
            return yield* new ValidationSkipped({
              ruleKey: RULE_KEYS.ALLOWED_FILE_TYPES,
              reason: "Unable to determine file extension",
            })
          }

          if (!parsedAllowedFileTypes.includes(extension.value)) {
            return yield* new ValidationFailure({
              ruleKey: RULE_KEYS.ALLOWED_FILE_TYPES,
              message: `Invalid file extension: '${extension.value}' (allowed: ${parsedAllowedFileTypes.join(", ")})`,
              context: {
                extension,
                allowedExtensions: parsedAllowedFileTypes,
              },
            })
          }

          const filteredMimeTypes = Object.entries(
            IMAGE_EXTENSION_TO_MIME_TYPE
          ).filter(([key, _]) => params.allowedFileTypes.includes(key))

          if (filteredMimeTypes.length === 0) {
            return yield* new ValidationFailure({
              ruleKey: RULE_KEYS.ALLOWED_FILE_TYPES,
              message: `No valid mime types found for allowed extensions`,
            })
          }

          const isValidMimeType = filteredMimeTypes.some(
            ([_, value]) => value === input.mimeType
          )

          if (!isValidMimeType) {
            return yield* new ValidationFailure({
              ruleKey: RULE_KEYS.ALLOWED_FILE_TYPES,
              message: `Invalid file mime type: ${input.mimeType} (allowed: ${filteredMimeTypes.map(([key]) => key).join(", ")})`,
              context: {
                actualMimeType: input.mimeType,
                allowedMimeTypes: filteredMimeTypes.map(([_, value]) => value),
              },
            })
          }

          return yield* Effect.succeed(
            "File is valid and within the allowed file types"
          )
        })
      const validateTimeframe = (
        params: RuleParams["within_timerange"],
        input: ValidationInput
      ) =>
        Effect.gen(function*() {
          const start =
            typeof params.start === "string"
              ? new Date(params.start)
              : params.start
          const end =
            typeof params.end === "string" ? new Date(params.end) : params.end

          const timestamp = getTimestamp(input.exif)

          console.log(JSON.stringify(input.exif, null, 2))

          console.log('timestamp', timestamp)

          if (Option.isNone(timestamp)) {
            return yield* new ValidationSkipped({
              ruleKey: RULE_KEYS.WITHIN_TIMERANGE,
              reason: "Unable to determine timestamp",
            })
          }

          if (timestamp.value < start || timestamp.value > end) {
            const formatDate = (date: Date) =>
              date.toISOString().replace("T", " ").substring(0, 16)

            return yield* new ValidationFailure({
              ruleKey: RULE_KEYS.WITHIN_TIMERANGE,
              message: `Photo was taken outside of the specified timeframe (${formatDate(start)} - ${formatDate(end)})`,
              context: {
                timestamp: timestamp.value.toISOString(),
                startTime: start.toISOString(),
                endTime: end.toISOString(),
              },
            })
          }

          return yield* Effect.succeed(
            "Photo was taken within the specified timeframe"
          )
        })
      const validateModified = (
        params: RuleParams["modified"],
        input: ValidationInput
      ) =>
        Effect.gen(function*() {
          const software = Option.fromNullable<string>(input.exif["Software"])

          if (Option.isSome(software) && software.value !== "") {
            const hasEditingSoftwareKeyword = EDITING_SOFTWARE_KEYWORDS.some(
              (keyword) => software.value.toLowerCase().includes(keyword)
            )

            if (hasEditingSoftwareKeyword) {
              return yield* new ValidationFailure({
                ruleKey: RULE_KEYS.MODIFIED,
                message: `Detected usage of photo editing software: ${software}`,
                context: { software },
              })
            }
          }

          const createDate =
            input.exif.DateTimeOriginal || input.exif.CreateDate
          const modifyDate = input.exif.ModifyDate || input.exif.DateTime

          if (
            createDate &&
            modifyDate &&
            typeof createDate === "string" &&
            typeof modifyDate === "string"
          ) {
            const createTime = new Date(createDate).getTime()
            const modifyTime = new Date(modifyDate).getTime()

            const ONE_HOUR_MS = 60 * 60 * 1000
            const isEdited = modifyTime - createTime > ONE_HOUR_MS

            if (isEdited) {
              return yield* new ValidationFailure({
                ruleKey: RULE_KEYS.MODIFIED,
                message:
                  "Detected timestamp inconsistencies. Possible editing.",
                context: {
                  createTime: new Date(createTime).toISOString(),
                  modifyTime: new Date(modifyTime).toISOString(),
                  timeDifferenceHours:
                    (modifyTime - createTime) / (60 * 60 * 1000),
                },
              })
            }
          }

          const exifData = input.exif
          const meaningfulProperties = Object.entries(exifData).filter(
            ([_, value]) => {
              if (value === null || value === undefined || value === "")
                return false
              if (typeof value === "string" && value.trim() === "") return false
              return true
            }
          )

          const propertyCount = meaningfulProperties.length
          const MIN_EXPECTED_PROPERTIES = 15

          if (propertyCount < MIN_EXPECTED_PROPERTIES) {
            return yield* new ValidationFailure({
              ruleKey: RULE_KEYS.MODIFIED,
              message: `Limited EXIF data detected (${propertyCount} properties). Possible editing or export from editing software.`,
              context: {
                propertyCount,
                minExpected: MIN_EXPECTED_PROPERTIES,
              },
            })
          }

          return yield* Effect.succeed(void 0)
        })
      return {
        validateMaxFileSize,
        validateAllowedFileTypes,
        validateTimeframe,
        validateModified,
      }
    }),
  }
) {
}
