import { defineScript, lua } from "upstash-lua";
import { Schema } from "effect"
import { NumberToStringSchema } from "./utils";

export const atomicIncrementFailedScript = defineScript({
  name: "atomicIncrementFailed",
  keys: {
    key: Schema.toStandardSchemaV1(Schema.String),
  },
  args: {
    totalChunks: Schema.toStandardSchemaV1(
      NumberToStringSchema
    ),
    now: Schema.toStandardSchemaV1(Schema.String),
    failedJobId: Schema.toStandardSchemaV1(Schema.String),
    ttl: Schema.toStandardSchemaV1(NumberToStringSchema),
  },
  lua: ({ KEYS, ARGV }) => lua`
    local key = ${KEYS.key}
    local totalChunks = tonumber(${ARGV.totalChunks})
    local now = ${ARGV.now}
    local failedJobId = ${ARGV.failedJobId}

    -- Check if hash exists
    if redis.call('EXISTS', key) == 0 then
      return nil
    end

    -- Atomically increment failedChunks
    local newFailedChunks = redis.call('HINCRBY', key, 'failedChunks', 1)
    redis.call('HSET', key, 'lastUpdatedAt', now)

    -- Append failedJobId to the list (stored as comma-separated string)
    local currentFailedJobIds = redis.call('HGET', key, 'failedJobIds') or ''
    if currentFailedJobIds == '' then
      redis.call('HSET', key, 'failedJobIds', failedJobId)
    else
      redis.call('HSET', key, 'failedJobIds', currentFailedJobIds .. ',' .. failedJobId)
    end

    -- Get current completedChunks
    local completedChunks = tonumber(redis.call('HGET', key, 'completedChunks') or '0')

    -- Check if all chunks are now processed
    local processedChunks = completedChunks + newFailedChunks
    local status = redis.call('HGET', key, 'status')

    if processedChunks >= totalChunks then
      status = 'failed'
      redis.call('HSET', key, 'status', status)
    end

    -- Refresh TTL
    redis.call('EXPIRE', key, ${ARGV.ttl})

    return cjson.encode({
      completedChunks = completedChunks,
      failedChunks = newFailedChunks,
      status = status
    })
  `,
  returns: Schema.toStandardSchemaV1(Schema.NullOr(Schema.String)),
})