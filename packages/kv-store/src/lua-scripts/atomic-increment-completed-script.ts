import { Schema } from "effect";
import { defineScript, lua } from 'upstash-lua'
import { NumberToStringSchema } from "./utils";

export const atomicIncrementCompletedScript = defineScript({
  name: "atomicIncrementCompleted",
  keys: {
    key: Schema.toStandardSchemaV1(Schema.String),
  },
  args: {
    totalChunks: Schema.toStandardSchemaV1(
      NumberToStringSchema
    ),
    now: Schema.toStandardSchemaV1(Schema.String),
    ttl: Schema.toStandardSchemaV1(NumberToStringSchema),
  },
  lua: ({ KEYS, ARGV }) => lua`
    local key = ${KEYS.key}
    local totalChunks = tonumber(${ARGV.totalChunks})
    local now = ${ARGV.now}

    -- Check if hash exists
    if redis.call('EXISTS', key) == 0 then
      return nil
    end

    -- Atomically increment completedChunks
    local newCompletedChunks = redis.call('HINCRBY', key, 'completedChunks', 1)
    redis.call('HSET', key, 'lastUpdatedAt', now)

    -- Get current failedChunks
    local failedChunks = tonumber(redis.call('HGET', key, 'failedChunks') or '0')

    -- Check if all chunks are now processed
    local processedChunks = newCompletedChunks + failedChunks
    local status = redis.call('HGET', key, 'status')

    if processedChunks >= totalChunks then
      if failedChunks > 0 then
        status = 'failed'
      else
        status = 'completed'
      end
      redis.call('HSET', key, 'status', status)
    end

    -- Refresh TTL
    redis.call('EXPIRE', key, ${ARGV.ttl})

    return cjson.encode({
      completedChunks = newCompletedChunks,
      failedChunks = failedChunks,
      status = status
    })
  `,
  returns: Schema.toStandardSchemaV1(Schema.NullOr(Schema.String))
})