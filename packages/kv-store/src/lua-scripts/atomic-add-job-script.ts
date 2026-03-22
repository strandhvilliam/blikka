import { Schema } from "effect"
import { defineScript, lua } from "upstash-lua"
import { NumberToStringSchema } from "./utils"

export const atomicAddJobScript = defineScript({
  name: "atomicAddJob",
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

    -- Check if hash exists
    if redis.call('EXISTS', key) == 0 then
      return nil
    end

    -- Get current jobIds (expecting a JSON array string like "[]" or "["id1"]")
    local currentJobIds = redis.call('HGET', key, 'jobIds') or '[]'

    local newJobIds
    if currentJobIds == '[]' or currentJobIds == '' then
      -- Create new array with the single jobId
      newJobIds = '["' .. jobId .. '"]'
    else
      -- Remove the trailing ']' and append the new jobId
      newJobIds = string.sub(currentJobIds, 1, -2) .. ',"' .. jobId .. '"]'
    end

    redis.call('HSET', key, 'jobIds', newJobIds)
    redis.call('HSET', key, 'lastUpdatedAt', now)

    -- Update status from initializing to processing if needed
    local status = redis.call('HGET', key, 'status')
    if status == 'initializing' then
      redis.call('HSET', key, 'status', 'processing')
      status = 'processing'
    end

    -- Refresh TTL
    redis.call('EXPIRE', key, ${ARGV.ttl})

    return status
  `,
  returns: Schema.toStandardSchemaV1(Schema.NullOr(Schema.String)),
})
