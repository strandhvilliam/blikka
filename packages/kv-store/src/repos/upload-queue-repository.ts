import { Duration, Effect, Option, Schedule, Schema } from "effect"
import { RedisClient, RedisError } from "@blikka/redis"
import { KeyFactory } from "../key-factory"
import { luaQueueStatusOrAcquire } from "../lua-scripts/lua-queue-status-or-acquire"
import { luaQueueHeartbeat } from "../lua-scripts/lua-queue-heartbeat"
import { luaQueueRelease } from "../lua-scripts/lua-queue-release"
import { luaQueueCancel } from "../lua-scripts/lua-queue-cancel"

interface WaitResult {
  status: "WAIT"
  position: number
  activeCount: number
  limit: number
  pollAfterMs: number
}

interface GrantedResult {
  status: "GRANTED"
  leaseId: string
  leaseExpiresAtMs: number
  activeCount: number
  limit: number
}

export type UploadQueueResult = WaitResult | GrantedResult

interface HeartbeatOkResult {
  ok: true
  leaseExpiresAtMs: number
}

interface HeartbeatNotOkResult {
  ok: false
  reason: "NOT_ACTIVE" | "LEASE_MISMATCH"
}

export type UploadQueueHeartbeatResult = HeartbeatOkResult | HeartbeatNotOkResult

interface ReleaseResult {
  result: "RELEASED" | "NOT_ACTIVE" | "LEASE_MISMATCH"
}

interface CancelResult {
  removed: number
}

const QueueStatusOrAcquireSchema = Schema.Union(
  Schema.Tuple(
    Schema.Literal("GRANTED"),
    Schema.String,
    Schema.Number,
    Schema.Number,
    Schema.Number
  ),
  Schema.Tuple(
    Schema.Literal("WAIT"),
    Schema.Number,
    Schema.Number,
    Schema.Number,
    Schema.Number
  )
)

const QueueHeartbeatSchema = Schema.Union(
  Schema.Tuple(Schema.Literal("OK"), Schema.Number),
  Schema.Tuple(Schema.Literal("NOT_ACTIVE")),
  Schema.Tuple(Schema.Literal("LEASE_MISMATCH"))
)

const QueueReleaseSchema = Schema.Union(
  Schema.Tuple(Schema.Literal("RELEASED")),
  Schema.Tuple(Schema.Literal("NOT_ACTIVE")),
  Schema.Tuple(Schema.Literal("LEASE_MISMATCH"))
)

const QueueCancelSchema = Schema.Tuple(Schema.Literal("CANCELLED"), Schema.Number)

function mapStatusOrAcquireResult(
  result: typeof QueueStatusOrAcquireSchema.Type
): UploadQueueResult {
  if (result[0] === "GRANTED") {
    const [, leaseId, leaseExpiresAtMs, activeCount, limit] = result
    return {
      status: "GRANTED",
      leaseId,
      leaseExpiresAtMs,
      activeCount,
      limit,
    }
  }
  const [, position, activeCount, limit, pollAfterMs] = result
  return {
    status: "WAIT",
    position,
    activeCount,
    limit,
    pollAfterMs,
  }
}

function mapHeartbeatResult(result: typeof QueueHeartbeatSchema.Type): UploadQueueHeartbeatResult {
  switch (result[0]) {
    case "OK":
      return { ok: true, leaseExpiresAtMs: result[1] }
    case "NOT_ACTIVE":
    case "LEASE_MISMATCH":
      return { ok: false, reason: result[0] }
  }
}

function mapReleaseResult(result: typeof QueueReleaseSchema.Type): ReleaseResult {
  return { result: result[0] }
}

function mapCancelResult(result: typeof QueueCancelSchema.Type): CancelResult {
  return { removed: result[1] }
}

export class UploadQueueRepository extends Effect.Service<UploadQueueRepository>()(
  "@blikka/packages/kv-store/upload-queue-repository",
  {
    dependencies: [RedisClient.Default, KeyFactory.Default],
    effect: Effect.gen(function* () {
      const redis = yield* RedisClient
      const keyFactory = yield* KeyFactory

      const statusOrAcquire = Effect.fn(
        "UploadQueueRepository.statusOrAcquire"
      )(
        function* (args: {
          domain: string
          reference: string
          limit: number
          leaseTtlMs: number
          pollMinMs?: number
        }) {
          const member = keyFactory.uploadQueueMember(args.domain, args.reference)
          const waitingKey = keyFactory.uploadQueueWaiting()
          const activeKey = keyFactory.uploadQueueActive()
          const leaseKeyPrefix = keyFactory.uploadQueueLeasePrefix()
          const pollMinMs = args.pollMinMs ?? 1000

          const [raw] = yield* redis.use((client) =>
            client.eval<unknown[], string[]>(
              luaQueueStatusOrAcquire,
              [waitingKey, activeKey],
              [
                member,
                String(args.limit),
                String(args.leaseTtlMs),
                leaseKeyPrefix,
                String(pollMinMs),
              ]
            )
          )

          const decoded = yield* Schema.decodeUnknown(QueueStatusOrAcquireSchema)(raw)
          return mapStatusOrAcquireResult(decoded)
        },
        Effect.mapError(
          (error) =>
            new RedisError({
              message: "Failed to statusOrAcquire upload queue slot",
              cause: error,
            })
        ),
        Effect.retry(
          Schedule.compose(Schedule.exponential(Duration.millis(100)), Schedule.recurs(3))
        )
      )

      const heartbeat = Effect.fn("UploadQueueRepository.heartbeat")(
        function* (args: { domain: string; reference: string; leaseId: string; leaseTtlMs: number }) {
          const member = keyFactory.uploadQueueMember(args.domain, args.reference)
          const activeKey = keyFactory.uploadQueueActive()
          const leaseKeyPrefix = keyFactory.uploadQueueLeasePrefix()

          const [raw] = yield* redis.use((client) =>
            client.eval<unknown[], string[]>(
              luaQueueHeartbeat,
              [activeKey],
              [member, args.leaseId, String(args.leaseTtlMs), leaseKeyPrefix]
            )
          )

          const decoded = yield* Schema.decodeUnknown(QueueHeartbeatSchema)(raw)
          return mapHeartbeatResult(decoded)
        },
        Effect.mapError(
          (error) =>
            new RedisError({
              message: "Failed to heartbeat upload queue slot",
              cause: error,
            })
        ),
        Effect.retry(
          Schedule.compose(Schedule.exponential(Duration.millis(100)), Schedule.recurs(3))
        )
      )

      const release = Effect.fn("UploadQueueRepository.release")(
        function* (args: { domain: string; reference: string; leaseId: string }) {
          const member = keyFactory.uploadQueueMember(args.domain, args.reference)
          const activeKey = keyFactory.uploadQueueActive()
          const leaseKeyPrefix = keyFactory.uploadQueueLeasePrefix()

          const [raw] = yield* redis.use((client) =>
            client.eval<unknown[], string[]>(
              luaQueueRelease,
              [activeKey],
              [member, args.leaseId, leaseKeyPrefix]
            )
          )

          const decoded = yield* Schema.decodeUnknown(QueueReleaseSchema)(raw)
          return mapReleaseResult(decoded)
        },
        Effect.mapError(
          (error) =>
            new RedisError({
              message: "Failed to release upload queue slot",
              cause: error,
            })
        ),
        Effect.retry(
          Schedule.compose(Schedule.exponential(Duration.millis(100)), Schedule.recurs(3))
        )
      )

      const cancel = Effect.fn("UploadQueueRepository.cancel")(
        function* (args: { domain: string; reference: string }) {
          const member = keyFactory.uploadQueueMember(args.domain, args.reference)
          const waitingKey = keyFactory.uploadQueueWaiting()

          const [raw] = yield* redis.use((client) =>
            client.eval<unknown[], string[]>(luaQueueCancel, [waitingKey], [member])
          )

          const decoded = yield* Schema.decodeUnknown(QueueCancelSchema)(raw)
          return mapCancelResult(decoded)
        },
        Effect.mapError(
          (error) =>
            new RedisError({
              message: "Failed to cancel upload queue slot",
              cause: error,
            })
        ),
        Effect.retry(
          Schedule.compose(Schedule.exponential(Duration.millis(100)), Schedule.recurs(3))
        )
      )

      const getLeaseId = Effect.fn("UploadQueueRepository.getLeaseId")(
        function* (args: { domain: string; reference: string }) {
          const leaseKeyPrefix = keyFactory.uploadQueueLeasePrefix()
          const member = keyFactory.uploadQueueMember(args.domain, args.reference)
          const leaseId = yield* redis.use((client) => client.get<string>(leaseKeyPrefix + member))
          return Option.fromNullable(leaseId)
        },
        Effect.mapError(
          (error) =>
            new RedisError({
              message: "Failed to get upload queue lease id",
              cause: error,
            })
        )
      )

      return {
        statusOrAcquire,
        heartbeat,
        release,
        cancel,
        getLeaseId,
      } as const
    }),
  }
) {}


