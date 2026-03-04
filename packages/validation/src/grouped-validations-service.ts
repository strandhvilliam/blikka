import { Effect, Layer, Option, ServiceMap } from "effect"
import type { RuleParams, ValidationInput } from "./types"
import { RULE_KEYS } from "./constants"
import { getTimestamp, getDeviceIdentifier } from "./utils"
import { ValidationFailure, ValidationSkipped } from "./types"

export class GroupedValidationsService extends ServiceMap.Service<GroupedValidationsService>()(
  "@blikka/packages/validation/GroupedValidationsService",
  {
    make: Effect.gen(function* () {
      const validateStrictTimestampOrdering = (
        _: RuleParams["strict_timestamp_ordering"],
        inputs: ValidationInput[]
      ) =>
        Effect.gen(function* () {
          if (!inputs || inputs.length <= 1) {
            return yield* new ValidationSkipped({
              ruleKey: RULE_KEYS.STRICT_TIMESTAMP_ORDERING,
              reason: "Not enough images to validate timestamp ordering",
            })
          }

          const timestampEntries = yield* Effect.forEach(
            inputs,
            ({ exif, orderIndex }) =>
              Effect.gen(function* () {
                const timestamp = getTimestamp(exif)
                if (Option.isNone(timestamp)) {
                  return yield* new ValidationSkipped({
                    ruleKey: RULE_KEYS.STRICT_TIMESTAMP_ORDERING,
                    reason: "Unable to determine timestamp",
                  })
                }
                return { orderIndex, timestamp: timestamp.value }
              })
          )

          if (timestampEntries.length < 2) {
            return yield* new ValidationSkipped({
              ruleKey: RULE_KEYS.STRICT_TIMESTAMP_ORDERING,
              reason:
                "Not enough images with valid timestamps to validate ordering",
            })
          }

          const sortedByTime = [...timestampEntries].sort(
            (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
          )

          const isOrderCorrect = sortedByTime.every((entry, index) => {
            if (index === 0) return true

            const prevEntry = sortedByTime[index - 1]
            return entry.orderIndex > (prevEntry?.orderIndex ?? -1)
          })

          if (!isOrderCorrect) {
            return yield* Effect.fail(
              new ValidationFailure({
                ruleKey: RULE_KEYS.STRICT_TIMESTAMP_ORDERING,
                message:
                  "Image order does not match chronological timestamp order",
                context: {
                  timestampEntries: timestampEntries.map(
                    ({ orderIndex, timestamp }) => ({
                      orderIndex,
                      timestamp: timestamp.toISOString(),
                    })
                  ),
                },
              })
            )
          }

          return yield* Effect.succeed(
            "Image order matches chronological timestamp order"
          )
        })
      const validateSameDevice = (
        _: RuleParams["same_device"],
        inputs: ValidationInput[]
      ) =>
        Effect.gen(function* () {
          if (!inputs || inputs.length <= 1) {
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
          const allSameDevice = deviceIdentifiers.every(
            (identifier) => identifier === firstIdentifier
          )

          if (!allSameDevice) {
            const uniqueIdentifiers = deviceIdentifiers.filter(
              (identifier, index) =>
                deviceIdentifiers.indexOf(identifier) === index
            )

            return yield* new ValidationFailure({
              ruleKey: RULE_KEYS.SAME_DEVICE,
              message: `Different devices detected: ${uniqueIdentifiers.join(", ")}`,
              context: { devices: uniqueIdentifiers },
            })
          }

          return yield* Effect.succeed(void 0)
        })
      return {
        validateStrictTimestampOrdering,
        validateSameDevice,
      }
    }),
  }
) {
  static layer = Layer.effect(this, this.make)
}
