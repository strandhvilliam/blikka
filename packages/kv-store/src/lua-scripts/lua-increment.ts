import { Schema } from "effect"
import { defineScript, lua } from "upstash-lua"
import { NumberToStringSchema } from "./utils"

export const incrementParticipantScript = defineScript({
  name: "incrementParticipant",
  keys: {
    key: Schema.toStandardSchemaV1(Schema.String),
  },
  args: {
    orderIndex: Schema.toStandardSchemaV1(NumberToStringSchema),
  },
  lua: ({ KEYS, ARGV }) => lua`
    local key = ${KEYS.key}
    local orderIndex = tonumber(${ARGV.orderIndex})

    if not orderIndex or orderIndex < 0 then
      return "INVALID_ORDER_INDEX"
    end

    local alreadyFinalized = redis.call("HGET", key, "finalized")

    if alreadyFinalized == "true" then
      return "ALREADY_FINALIZED"
    end

    local processedIndexesJson = redis.call("HGET", key, "processedIndexes")
    local orderIndexesJson = redis.call("HGET", key, "orderIndexes")
    local expectedCount = tonumber(redis.call("HGET", key, "expectedCount"))

    if not processedIndexesJson or not orderIndexesJson or not expectedCount then
      return "MISSING_DATA"
    end

    local processedIndexes = cjson.decode(processedIndexesJson)
    local orderIndexes = cjson.decode(orderIndexesJson)
    local processedSlot = nil

    for i = 1, #orderIndexes do
      if tonumber(orderIndexes[i]) == orderIndex then
        processedSlot = i
        break
      end
    end

    if not processedSlot or processedSlot < 1 or processedSlot > #processedIndexes then
      return "INVALID_ORDER_INDEX"
    end

    if processedIndexes[processedSlot] == 1 then
      return "DUPLICATE_ORDER_INDEX"
    end

    processedIndexes[processedSlot] = 1

    redis.call("HSET", key, "processedIndexes", cjson.encode(processedIndexes))

    local processedCount = 0

    for i = 1, #processedIndexes do
      if processedIndexes[i] == 1 then
        processedCount = processedCount + 1
      end
    end

    local status = "PROCESSED_SUBMISSION"

    if expectedCount <= processedCount then
      redis.call("HSET", key, "finalized", "true")
      status = "FINALIZED"
    end

    return status
  `,
  returns: Schema.toStandardSchemaV1(Schema.String),
})
