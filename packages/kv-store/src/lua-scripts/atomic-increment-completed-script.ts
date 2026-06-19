import { Schema } from 'effect'
import { defineScript, lua } from 'upstash-lua'
import { NumberToStringSchema } from './utils'

export const atomicIncrementCompletedScript = defineScript({
  name: 'atomicIncrementCompleted',
  keys: {
    key: Schema.toStandardSchemaV1(Schema.String),
  },
  args: {
    totalChunks: Schema.toStandardSchemaV1(NumberToStringSchema),
    now: Schema.toStandardSchemaV1(Schema.String),
    completedJobId: Schema.toStandardSchemaV1(Schema.String),
    ttl: Schema.toStandardSchemaV1(NumberToStringSchema),
  },
  lua: ({ KEYS, ARGV }) => lua`
    local key = ${KEYS.key}
    local totalChunks = tonumber(${ARGV.totalChunks})
    local now = ${ARGV.now}
    local completedJobId = ${ARGV.completedJobId}

    -- Check if hash exists
    if redis.call('EXISTS', key) == 0 then
      return nil
    end

    -- Atomically increment completedChunks
    local newCompletedChunks = redis.call('HINCRBY', key, 'completedChunks', 1)
    redis.call('HSET', key, 'lastUpdatedAt', now)

    -- Append completedJobId to the list (stored as comma-separated string, mirrors failedJobIds)
    local currentCompletedJobIds = redis.call('HGET', key, 'completedJobIds') or ''
    if currentCompletedJobIds == '' then
      redis.call('HSET', key, 'completedJobIds', completedJobId)
    else
      redis.call('HSET', key, 'completedJobIds', currentCompletedJobIds .. ',' .. completedJobId)
    end

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
  // The script returns `cjson.encode(...)` (a JSON string), but `@upstash/redis` has
  // `automaticDeserialization` on by default and JSON.parses string replies back into an object
  // before upstash-lua validates the result — so the declared shape must be the parsed object,
  // not a string. `nil` is returned (as null) when the process hash no longer exists.
  returns: Schema.toStandardSchemaV1(
    Schema.NullOr(
      Schema.Struct({
        completedChunks: Schema.Number,
        failedChunks: Schema.Number,
        status: Schema.String,
      }),
    ),
  ),
})
