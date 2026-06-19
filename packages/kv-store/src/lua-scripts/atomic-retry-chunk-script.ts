import { defineScript, lua } from 'upstash-lua'
import { Schema } from 'effect'
import { NumberToStringSchema } from './utils'

/**
 * Re-queues a previously failed chunk: removes it from `failedJobIds`, decrements `failedChunks`
 * (floored at 0), and flips the process back to `processing` so the re-triggered ECS job is not
 * skipped by the active-process guard. Idempotent — a jobId that isn't currently failed is a no-op
 * for the counters but still reactivates the process.
 */
export const atomicRetryChunkScript = defineScript({
  name: 'atomicRetryChunk',
  keys: {
    key: Schema.toStandardSchemaV1(Schema.String),
  },
  args: {
    jobId: Schema.toStandardSchemaV1(Schema.String),
    now: Schema.toStandardSchemaV1(Schema.String),
    ttl: Schema.toStandardSchemaV1(NumberToStringSchema),
  },
  lua: ({ KEYS, ARGV }) => lua`
    local key = ${KEYS.key}
    local jobId = ${ARGV.jobId}
    local now = ${ARGV.now}

    if redis.call('EXISTS', key) == 0 then
      return nil
    end

    local current = redis.call('HGET', key, 'failedJobIds') or ''
    local rebuilt = {}
    local removed = 0
    for token in string.gmatch(current, '([^,]+)') do
      if token == jobId then
        removed = removed + 1
      else
        table.insert(rebuilt, token)
      end
    end

    if removed > 0 then
      redis.call('HSET', key, 'failedJobIds', table.concat(rebuilt, ','))
      local failedChunks = tonumber(redis.call('HGET', key, 'failedChunks') or '0') - removed
      if failedChunks < 0 then failedChunks = 0 end
      redis.call('HSET', key, 'failedChunks', failedChunks)
    end

    redis.call('HSET', key, 'status', 'processing')
    redis.call('HSET', key, 'lastUpdatedAt', now)
    redis.call('EXPIRE', key, ${ARGV.ttl})

    return cjson.encode({ removed = removed })
  `,
  // The script returns `cjson.encode(...)` (a JSON string), but `@upstash/redis` has
  // `automaticDeserialization` on by default and JSON.parses string replies back into an object
  // before upstash-lua validates the result — so the declared shape must be the parsed object,
  // not a string. `nil` is returned (as null) when the process hash no longer exists.
  returns: Schema.toStandardSchemaV1(Schema.NullOr(Schema.Struct({ removed: Schema.Number }))),
})
