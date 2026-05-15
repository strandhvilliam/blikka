import { Effect, Option } from "effect"
import { EDITING_SOFTWARE_KEYWORDS, IMAGE_EXTENSION_TO_MIME_TYPE, RULE_KEYS } from "./constants"
import {
  type RuleParams,
  ValidationFailure,
  type ValidationInput,
  ValidationSkipped,
} from "./schemas"

const ONE_HOUR_MS = 60 * 60 * 1000

function normalizeImageExtensionAlias(extension: string): string {
  const normalizedExtension = extension.toLowerCase()
  return normalizedExtension === "jpeg" ? "jpg" : normalizedExtension
}

function normalizeAllowedFileTypes(allowedFileTypes: readonly string[]): string[] {
  const normalizedAllowedFileTypes = new Set<string>()

  for (const allowedFileType of allowedFileTypes) {
    normalizedAllowedFileTypes.add(normalizeImageExtensionAlias(allowedFileType))
  }

  return [...normalizedAllowedFileTypes]
}

function getTimestamp(exif: Record<string, unknown>): Option.Option<Date> {
  return Option.fromNullishOr(
    exif.DateTimeOriginal ?? exif.DateTimeDigitized ?? exif.CreateDate,
  ).pipe(
    Option.filter((timestamp) => typeof timestamp === "string" || timestamp instanceof Date),
    Option.flatMap((timestamp) => {
      const date = new Date(timestamp)
      return isNaN(date.getTime()) ? Option.none() : Option.some(date)
    }),
  )
}

function getDeviceIdentifier(exif: Record<string, unknown>): Option.Option<string> {
  return Option.fromNullishOr(exif.Model).pipe(
    Option.filter((m): m is string => typeof m === "string"),
    Option.map((model) => {
      if (exif.Make && typeof exif.Make === "string") {
        const serial =
          exif.SerialNumber && typeof exif.SerialNumber === "string" ? `-${exif.SerialNumber}` : ""
        return `${exif.Make}-${model}${serial}`
      }
      return model
    }),
  )
}

function getExtensionFromFilename(filename: string): Option.Option<string> {
  const match = filename.match(/\.([^.]+)$/)
  return Option.fromNullishOr(match?.[1]).pipe(
    Option.map((extension) => normalizeImageExtensionAlias(extension.replace(/^\./, ""))),
  )
}

export const validateMaxFileSize = Effect.fn("validateMaxFileSize")(function* (
  params: RuleParams["max_file_size"],
  input: ValidationInput,
) {
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
})

export const validateAllowedFileTypes = Effect.fn("validateAllowedFileTypes")(function* (
  params: RuleParams["allowed_file_types"],
  input: ValidationInput,
) {
  const normalizedAllowedFileTypes = normalizeAllowedFileTypes(params.allowedFileTypes)
  const extension = getExtensionFromFilename(input.fileName)

  if (Option.isNone(extension)) {
    return yield* new ValidationSkipped({
      ruleKey: RULE_KEYS.ALLOWED_FILE_TYPES,
      reason: "Unable to determine file extension",
    })
  }

  if (!normalizedAllowedFileTypes.includes(extension.value)) {
    return yield* new ValidationFailure({
      ruleKey: RULE_KEYS.ALLOWED_FILE_TYPES,
      message: `Invalid file extension: '${extension.value}' (allowed: ${normalizedAllowedFileTypes.join(", ")})`,
      context: {
        extension: extension.value,
        allowedExtensions: normalizedAllowedFileTypes,
      },
    })
  }

  const filteredMimeTypes = Object.entries(IMAGE_EXTENSION_TO_MIME_TYPE).filter(([key]) =>
    normalizedAllowedFileTypes.includes(key),
  )

  if (filteredMimeTypes.length === 0) {
    return yield* new ValidationFailure({
      ruleKey: RULE_KEYS.ALLOWED_FILE_TYPES,
      message: "No valid mime types found for allowed extensions",
    })
  }

  const isValidMimeType = filteredMimeTypes.some(([, value]) => value === input.mimeType)

  if (!isValidMimeType) {
    return yield* new ValidationFailure({
      ruleKey: RULE_KEYS.ALLOWED_FILE_TYPES,
      message: `Invalid file mime type: ${input.mimeType} (allowed: ${normalizedAllowedFileTypes.join(", ")})`,
      context: {
        actualMimeType: input.mimeType,
        allowedMimeTypes: filteredMimeTypes.map(([, value]) => value),
      },
    })
  }

  return "File is valid and within the allowed file types"
})

export const validateTimeframe = Effect.fn("validateTimeframe")(function* (
  params: RuleParams["within_timerange"],
  input: ValidationInput,
) {
  const start = typeof params.start === "string" ? new Date(params.start) : params.start
  const end = typeof params.end === "string" ? new Date(params.end) : params.end

  const timestamp = getTimestamp(input.exif)

  if (Option.isNone(timestamp)) {
    return yield* new ValidationSkipped({
      ruleKey: RULE_KEYS.WITHIN_TIMERANGE,
      reason: "Unable to determine timestamp",
    })
  }

  if (timestamp.value < start || timestamp.value > end) {
    const formatDate = (date: Date) => date.toISOString().replace("T", " ").substring(0, 16)

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

  return "Photo was taken within the specified timeframe"
})

export const validateModified = Effect.fn("validateModified")(function* (
  _: RuleParams["modified"],
  input: ValidationInput,
) {
  const software = Option.fromNullishOr<string>(input.exif["Software"])

  if (Option.isSome(software) && software.value !== "") {
    const hasEditingSoftwareKeyword = EDITING_SOFTWARE_KEYWORDS.some((keyword) =>
      software.value.toLowerCase().includes(keyword),
    )

    if (hasEditingSoftwareKeyword) {
      return yield* new ValidationFailure({
        ruleKey: RULE_KEYS.MODIFIED,
        message: `Detected usage of photo editing software: ${software}`,
        context: { software },
      })
    }
  }

  const createDate = input.exif.DateTimeOriginal || input.exif.CreateDate
  const modifyDate = input.exif.ModifyDate || input.exif.DateTime

  if (
    createDate &&
    modifyDate &&
    typeof createDate === "string" &&
    typeof modifyDate === "string"
  ) {
    const createTime = new Date(createDate).getTime()
    const modifyTime = new Date(modifyDate).getTime()

    const isEdited = modifyTime - createTime > ONE_HOUR_MS

    if (isEdited) {
      return yield* new ValidationFailure({
        ruleKey: RULE_KEYS.MODIFIED,
        message: "Detected timestamp inconsistencies. Possible editing.",
        context: {
          createTime: new Date(createTime).toISOString(),
          modifyTime: new Date(modifyTime).toISOString(),
          timeDifferenceHours: (modifyTime - createTime) / ONE_HOUR_MS,
        },
      })
    }
  }

  const exifData = input.exif
  const meaningfulProperties = Object.entries(exifData).filter(([, value]) => {
    if (value === null || value === undefined || value === "") return false
    if (typeof value === "string" && value.trim() === "") return false
    return true
  })

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
})

export const validateStrictTimestampOrdering = Effect.fn("validateStrictTimestampOrdering")(
  function* (_: RuleParams["strict_timestamp_ordering"], inputs: ValidationInput[]) {
    if (inputs.length <= 1) {
      return yield* new ValidationSkipped({
        ruleKey: RULE_KEYS.STRICT_TIMESTAMP_ORDERING,
        reason: "Not enough images to validate timestamp ordering",
      })
    }

    const timestampEntries = yield* Effect.forEach(inputs, ({ exif, orderIndex }) =>
      Effect.gen(function* () {
        const timestamp = getTimestamp(exif)
        if (Option.isNone(timestamp)) {
          return yield* new ValidationSkipped({
            ruleKey: RULE_KEYS.STRICT_TIMESTAMP_ORDERING,
            reason: "Unable to determine timestamp",
          })
        }
        return { orderIndex, timestamp: timestamp.value }
      }),
    )

    if (timestampEntries.length < 2) {
      return yield* new ValidationSkipped({
        ruleKey: RULE_KEYS.STRICT_TIMESTAMP_ORDERING,
        reason: "Not enough images with valid timestamps to validate ordering",
      })
    }

    const sortedByTime = [...timestampEntries].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    )

    const isOrderCorrect = sortedByTime.every((entry, index) => {
      if (index === 0) return true

      const prevEntry = sortedByTime[index - 1]
      return entry.orderIndex > (prevEntry?.orderIndex ?? -1)
    })

    if (!isOrderCorrect) {
      return yield* new ValidationFailure({
        ruleKey: RULE_KEYS.STRICT_TIMESTAMP_ORDERING,
        message: "Image order does not match chronological timestamp order",
        context: {
          timestampEntries: timestampEntries.map(({ orderIndex, timestamp }) => ({
            orderIndex,
            timestamp: timestamp.toISOString(),
          })),
        },
      })
    }

    return "Image order matches chronological timestamp order"
  },
)

export const validateSameDevice = Effect.fn("validateSameDevice")(function* (
  _: RuleParams["same_device"],
  inputs: ValidationInput[],
) {
  if (inputs.length <= 1) {
    return yield* new ValidationSkipped({
      ruleKey: RULE_KEYS.SAME_DEVICE,
      reason: "Not enough images to compare devices",
    })
  }

  const deviceIdentifiers = inputs
    .map(({ exif }) => getDeviceIdentifier(exif))
    .filter((identifier) => Option.isSome(identifier))
    .map((identifier) => identifier.value)

  if (deviceIdentifiers.length !== inputs.length) {
    return yield* new ValidationSkipped({
      ruleKey: RULE_KEYS.SAME_DEVICE,
      reason: `No device information found for ${inputs.length - deviceIdentifiers.length} images`,
    })
  }

  const firstIdentifier = deviceIdentifiers[0]
  const allSameDevice = deviceIdentifiers.every((identifier) => identifier === firstIdentifier)

  if (!allSameDevice) {
    const uniqueIdentifiers = deviceIdentifiers.filter(
      (identifier, index) => deviceIdentifiers.indexOf(identifier) === index,
    )

    return yield* new ValidationFailure({
      ruleKey: RULE_KEYS.SAME_DEVICE,
      message: `Different devices detected: ${uniqueIdentifiers.join(", ")}`,
      context: { devices: uniqueIdentifiers },
    })
  }
})
