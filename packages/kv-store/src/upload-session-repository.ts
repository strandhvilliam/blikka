import { Context, Duration, Effect, Layer, Option, Schedule, Schema, Struct } from "effect"
import { RedisClient, RedisClientLayer } from "@blikka/redis"
import { Keys } from "./key-factory"
import { incrementParticipantScript } from "./lua-scripts/lua-increment"

export const ParticipantStateSchema = Schema.Struct({
  uploadSessionId: Schema.String,
  expectedCount: Schema.Number,
  orderIndexes: Schema.Array(Schema.Number),
  processedIndexes: Schema.Array(Schema.Number),
  validated: Schema.Boolean,
  zipKey: Schema.String,
  contactSheetKey: Schema.String,
  errors: Schema.Array(Schema.String),
  finalized: Schema.Boolean,
  checkedAt: Schema.NullOr(Schema.String),
})

export const SubmissionStateSchema = Schema.Struct({
  uploadSessionId: Schema.String,
  key: Schema.String,
  orderIndex: Schema.Number,
  uploaded: Schema.Boolean,
  thumbnailKey: Schema.NullOr(Schema.String),
  exifProcessed: Schema.Boolean,
})

export const IncrementResultSchema = Schema.Literals([
  "FINALIZED",
  "PROCESSED_SUBMISSION",
  "DUPLICATE_ORDER_INDEX",
  "ALREADY_FINALIZED",
  "INVALID_ORDER_INDEX",
  "MISSING_DATA",
])

export class UploadSessionStoreUnavailable extends Schema.TaggedErrorClass<UploadSessionStoreUnavailable>()(
  "UploadSessionStoreUnavailable",
  {
    operation: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export class UploadSessionInvalidStatePatchError extends Schema.TaggedErrorClass<UploadSessionInvalidStatePatchError>()(
  "UploadSessionInvalidStatePatchError",
  {
    target: Schema.Literals(["participant", "submission"]),
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export class UploadSessionInvariantViolated extends Schema.TaggedErrorClass<UploadSessionInvariantViolated>()(
  "UploadSessionInvariantViolated",
  {
    reason: Schema.Literal("unexpected_increment_payload"),
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export class UploadSessionSubmissionOrderInvalid extends Schema.TaggedErrorClass<UploadSessionSubmissionOrderInvalid>()(
  "UploadSessionSubmissionOrderInvalid",
  {
    domain: Schema.String,
    reference: Schema.String,
    orderIndex: Schema.Number,
  },
) {}

export class UploadSessionSubmissionDataMissing extends Schema.TaggedErrorClass<UploadSessionSubmissionDataMissing>()(
  "UploadSessionSubmissionDataMissing",
  {
    domain: Schema.String,
    reference: Schema.String,
    orderIndex: Schema.Number,
  },
) {}

export class InvalidKeyFormatError extends Schema.TaggedErrorClass<InvalidKeyFormatError>()(
  "InvalidKeyFormatError",
  {
    message: Schema.String,
  },
) {}

export type UploadSessionRepositoryError =
  | UploadSessionStoreUnavailable
  | UploadSessionInvalidStatePatchError
  | UploadSessionInvariantViolated
  | UploadSessionSubmissionOrderInvalid
  | UploadSessionSubmissionDataMissing

export type IncrementResult = typeof IncrementResultSchema.Type
export type ParticipantState = typeof ParticipantStateSchema.Type
export type SubmissionState = typeof SubmissionStateSchema.Type

function isMissingHashResult(result: Record<string, unknown> | null | undefined) {
  return !result || Object.keys(result).length === 0
}

export class UploadSessionRepository extends Context.Service<
  UploadSessionRepository,
  {
    /**
     * Get the participant state from KV for a given domain and reference.
     */
    readonly getParticipantState: (
      domain: string,
      ref: string,
    ) => Effect.Effect<Option.Option<ParticipantState>, UploadSessionRepositoryError>

    /**
     * Get the submission state from KV for a given domain and reference and order index.
     */
    readonly getSubmissionState: (
      domain: string,
      ref: string,
      orderIndex: number,
    ) => Effect.Effect<Option.Option<SubmissionState>, UploadSessionRepositoryError>

    /**
     * Get all submission states from KV for a given domain and reference and order indexes.
     */
    readonly getAllSubmissionStates: (
      domain: string,
      ref: string,
      orderIndexes: Array<number>,
    ) => Effect.Effect<Array<SubmissionState>, UploadSessionRepositoryError>

    /**
     * Update the participant state in KV for a given domain and reference.
     */
    readonly updateParticipantSession: (
      domain: string,
      ref: string,
      state: Partial<ParticipantState>,
    ) => Effect.Effect<number, UploadSessionRepositoryError>

    /**
     * Update the submission state in KV for a given domain and reference and order index.
     */
    readonly updateSubmissionSession: (
      domain: string,
      ref: string,
      orderIndex: number,
      state: Partial<SubmissionState>,
    ) => Effect.Effect<number, UploadSessionRepositoryError>

    /**
     * Initialize the state in KV for a given domain and reference and submission keys.
     */
    readonly initializeState: (
      domain: string,
      reference: string,
      uploadSessionId: string,
      submissionKeys: ReadonlyArray<string>,
    ) => Effect.Effect<void, InvalidKeyFormatError | UploadSessionRepositoryError>

    /**
     * Set the participant error state in KV for a given domain and reference and code.
     */
    readonly setParticipantErrorState: (
      domain: string,
      ref: string,
      code: string,
    ) => Effect.Effect<void, UploadSessionRepositoryError>

    /**
     * Increment the participant state in KV for a given domain and reference and order index.
     */
    readonly incrementParticipantState: (
      domain: string,
      ref: string,
      orderIndex: number,
    ) => Effect.Effect<{ readonly status: IncrementResult }, UploadSessionRepositoryError>
  }
>()("@blikka/packages/kv-store/upload-session-repository") {}

const makeUploadSessionRepository = Effect.gen(function* () {
  const redis = yield* RedisClient
  const retryPolicy = Schedule.both(Schedule.exponential(Duration.millis(100)), Schedule.recurs(3))

  const parseKey = Effect.fnUntraced(function* (key: string) {
    const [domain, reference, formattedOrderIndex, fileName] = key.split("/")
    if (!domain || !reference || !formattedOrderIndex || !fileName) {
      return yield* Effect.fail(
        new InvalidKeyFormatError({
          message: `Missing: domain=${domain}, reference=${reference}, orderIndex=${formattedOrderIndex}, fileName=${fileName}`,
        }),
      )
    }
    const orderIndex = Number(formattedOrderIndex) - 1
    return yield* Effect.succeed({
      domain,
      reference,
      orderIndex,
      fileName,
    })
  })

  const getParticipantState: UploadSessionRepository["Service"]["getParticipantState"] = Effect.fn(
    "UploadSessionRepository.getParticipantState",
  )(
    function* (domain, ref) {
      const key = Keys.participant(domain, ref)
      const result = yield* redis
        .use((client) => client.hgetall(key))
        .pipe(
          Effect.catchTag("RedisError", (e) =>
            Effect.fail(
              new UploadSessionStoreUnavailable({ operation: "getParticipantState", cause: e }),
            ),
          ),
        )

      if (isMissingHashResult(result)) {
        return Option.none<ParticipantState>()
      }

      const parsed = Schema.decodeUnknownOption(ParticipantStateSchema)(result)
      return parsed
    },
    (effect, domain, ref) => Effect.annotateLogs(effect, { domain, reference: ref }),
  )

  const getSubmissionState: UploadSessionRepository["Service"]["getSubmissionState"] = Effect.fn(
    "UploadSessionRepository.getSubmissionState",
  )(
    function* (domain, ref, orderIndex) {
      const key = Keys.submission(domain, ref, orderIndex)
      const result = yield* redis
        .use((client) => client.hgetall(key))
        .pipe(
          Effect.catchTag("RedisError", (e) =>
            Effect.fail(
              new UploadSessionStoreUnavailable({ operation: "getSubmissionState", cause: e }),
            ),
          ),
        )
      if (isMissingHashResult(result)) {
        return Option.none<SubmissionState>()
      }
      const parsed = Schema.decodeUnknownOption(SubmissionStateSchema)(result)
      return parsed
    },
    (effect, domain, ref, orderIndex) =>
      Effect.annotateLogs(effect, { domain, reference: ref, orderIndex }),
  )

  const getAllSubmissionStates: UploadSessionRepository["Service"]["getAllSubmissionStates"] =
    Effect.fn("UploadSessionRepository.getAllSubmissionStates")(
      function* (domain, ref, orderIndexes) {
        const keys = orderIndexes.map((orderIndex) => Keys.submission(domain, ref, orderIndex))

        const result = yield* redis
          .use((client) => {
            const multi = keys.reduce((chain, redisKey) => chain.hgetall(redisKey), client.multi())
            return multi.exec<([string, Record<string, unknown>] | null)[]>()
          })
          .pipe(
            Effect.catchTag("RedisError", (e) =>
              Effect.fail(
                new UploadSessionStoreUnavailable({
                  operation: "getAllSubmissionStates",
                  cause: e,
                }),
              ),
            ),
          )

        return result.flatMap((entry) => {
          const hash = Array.isArray(entry) ? entry[1] : entry

          if (isMissingHashResult(hash)) {
            return []
          }

          const parsed = Schema.decodeUnknownOption(SubmissionStateSchema)(hash)

          return Option.match(parsed, {
            onSome: (state) => [state],
            onNone: () => [],
          })
        })
      },
      (effect, domain, ref, orderIndexes) =>
        Effect.annotateLogs(effect, {
          domain,
          reference: ref,
          submissionCount: orderIndexes.length,
        }),
    )

  const updateParticipantSession: UploadSessionRepository["Service"]["updateParticipantSession"] =
    Effect.fn("UploadSessionRepository.updateParticipantSession")(
      function* (domain, ref, state) {
        const key = Keys.participant(domain, ref)
        const encodedState = yield* Schema.encodeEffect(
          ParticipantStateSchema.mapFields(Struct.map(Schema.optional)),
        )(state).pipe(
          Effect.mapError(
            (issue) =>
              new UploadSessionInvalidStatePatchError({
                target: "participant",
                cause: issue,
              }),
          ),
        )
        return yield* redis
          .use((client) => client.hset(key, encodedState))
          .pipe(
            Effect.retry(retryPolicy),
            Effect.catchTag("RedisError", (e) =>
              Effect.fail(
                new UploadSessionStoreUnavailable({
                  operation: "updateParticipantSession",
                  cause: e,
                }),
              ),
            ),
          )
      },
      (effect, domain, ref, _state) => Effect.annotateLogs(effect, { domain, reference: ref }),
    )

  const updateSubmissionSession: UploadSessionRepository["Service"]["updateSubmissionSession"] =
    Effect.fn("UploadSessionRepository.updateSubmissionSession")(
      function* (domain, ref, orderIndex, state) {
        const key = Keys.submission(domain, ref, orderIndex)
        const encodedState = yield* Schema.encodeEffect(
          SubmissionStateSchema.mapFields(Struct.map(Schema.optional)),
        )(state).pipe(
          Effect.mapError(
            (issue) =>
              new UploadSessionInvalidStatePatchError({
                target: "submission",
                cause: issue,
              }),
          ),
        )
        return yield* redis
          .use((client) => client.hset(key, encodedState))
          .pipe(
            Effect.catchTag("RedisError", (e) =>
              Effect.fail(
                new UploadSessionStoreUnavailable({
                  operation: "updateSubmissionSession",
                  cause: e,
                }),
              ),
            ),
          )
      },
      (effect, domain, ref, orderIndex, _state) =>
        Effect.annotateLogs(effect, { domain, reference: ref, orderIndex }),
    )

  const initializeState: UploadSessionRepository["Service"]["initializeState"] = Effect.fn(
    "UploadSessionRepository.initState",
  )(
    function* (domain, reference, uploadSessionId, submissionKeys) {
      const map: Record<string, SubmissionState> = {}
      const submissionOrderIndexes: Array<number> = []

      for (const key of submissionKeys) {
        const { orderIndex } = yield* parseKey(key)
        submissionOrderIndexes.push(orderIndex)
        const redisKey = Keys.submission(domain, reference, orderIndex)
        map[redisKey] = SubmissionStateSchema.make({
          uploadSessionId,
          key,
          orderIndex,
          uploaded: false,
          thumbnailKey: null,
          exifProcessed: false,
        })
      }

      const participantState = ParticipantStateSchema.make({
        uploadSessionId,
        expectedCount: submissionKeys.length,
        orderIndexes: submissionOrderIndexes,
        processedIndexes: Array.from({ length: submissionKeys.length }, () => 0),
        validated: false,
        zipKey: "",
        contactSheetKey: "",
        errors: [],
        finalized: false,
        checkedAt: null,
      })

      const existingParticipantState = yield* getParticipantState(domain, reference)
      const staleOrderIndexes = Option.match(existingParticipantState, {
        onSome: (state) => state.orderIndexes,
        onNone: () => [],
      })

      yield* redis
        .use((client) => {
          const participantKey = Keys.participant(domain, reference)
          const entries = Object.entries(map)
          const staleSubmissionKeys = staleOrderIndexes.map((orderIndex) =>
            Keys.submission(domain, reference, orderIndex),
          )

          let multi = client.multi().del(participantKey)

          for (const staleSubmissionKey of staleSubmissionKeys) {
            multi = multi.del(staleSubmissionKey)
          }

          multi = multi.hset(participantKey, participantState)

          for (const [redisKey, value] of entries) {
            multi = multi.hset(redisKey, value)
          }

          return multi.exec()
        })
        .pipe(
          Effect.retry(retryPolicy),
          Effect.catchTag("RedisError", (e) =>
            Effect.fail(
              new UploadSessionStoreUnavailable({ operation: "initializeState", cause: e }),
            ),
          ),
        )
    },
    (
      effect,
      domain: string,
      reference: string,
      uploadSessionId: string,
      submissionKeys: ReadonlyArray<string>,
    ) =>
      Effect.annotateLogs(effect, {
        domain,
        reference,
        uploadSessionId,
        submissionKeyCount: submissionKeys.length,
      }),
  )

  const setParticipantErrorState: UploadSessionRepository["Service"]["setParticipantErrorState"] =
    Effect.fn("UploadSessionRepository.setErrorState")(
      function* (domain, ref, code) {
        const participantState = yield* getParticipantState(domain, ref)
        if (Option.isSome(participantState)) {
          yield* updateParticipantSession(domain, ref, {
            errors: [...participantState.value.errors, code],
          })
        }
      },
      (effect, domain, ref, code) => Effect.annotateLogs(effect, { domain, reference: ref, code }),
    )

  const incrementParticipantState: UploadSessionRepository["Service"]["incrementParticipantState"] =
    Effect.fn("UploadSessionRepository.incrementParticipantState")(
      function* (domain, ref, orderIndex) {
        const key = Keys.participant(domain, ref)
        const result = yield* redis
          .use((client) =>
            incrementParticipantScript.run(client, {
              keys: { key },
              args: { orderIndex },
            }),
          )
          .pipe(
            Effect.catchTag("RedisError", (e) =>
              Effect.fail(
                new UploadSessionStoreUnavailable({
                  operation: "incrementParticipantState",
                  cause: e,
                }),
              ),
            ),
          )

        const status = yield* Schema.decodeUnknownEffect(IncrementResultSchema)(result).pipe(
          Effect.mapError(
            (issue) =>
              new UploadSessionInvariantViolated({
                reason: "unexpected_increment_payload",
                cause: issue,
              }),
          ),
        )

        switch (status) {
          case "INVALID_ORDER_INDEX": {
            yield* setParticipantErrorState(domain, ref, status)
            return yield* new UploadSessionSubmissionOrderInvalid({
              domain,
              reference: ref,
              orderIndex,
            })
          }
          case "MISSING_DATA": {
            yield* setParticipantErrorState(domain, ref, status)
            return yield* new UploadSessionSubmissionDataMissing({
              domain,
              reference: ref,
              orderIndex,
            })
          }
          case "DUPLICATE_ORDER_INDEX":
            yield* Effect.logWarning("Duplicate order index provided, skipping")
            break
          case "ALREADY_FINALIZED":
            yield* Effect.logWarning(`[${domain}|${ref}|${orderIndex}] Already finalized, skipping`)
            break
        }

        return { status }
      },
      (effect, domain, ref, orderIndex) =>
        Effect.annotateLogs(effect, { domain, reference: ref, orderIndex }),
    )

  return UploadSessionRepository.of({
    getParticipantState,
    getSubmissionState,
    getAllSubmissionStates,
    updateParticipantSession,
    updateSubmissionSession,
    initializeState,
    setParticipantErrorState,
    incrementParticipantState,
  })
})

export const UploadSessionRepositoryLayerNoDeps = Layer.effect(
  UploadSessionRepository,
  makeUploadSessionRepository,
)

export const UploadSessionRepositoryLayer = UploadSessionRepositoryLayerNoDeps.pipe(
  Layer.provide(RedisClientLayer),
)
