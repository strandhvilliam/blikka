import "server-only"

import { Realtime, InferRealtimeEvents } from "@upstash/realtime"
import { Redis } from "@upstash/redis"
import z from "zod/v4"
import {
  realtimeEventKeys,
  realtimeResultOutcomes,
} from "@blikka/realtime/contract"

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

const RealtimeEventKeySchema = z.enum(realtimeEventKeys)
const RealtimeResultOutcomeSchema = z.enum(realtimeResultOutcomes)

const RealtimeEventResultPayloadBaseSchema = z.object({
  eventKey: RealtimeEventKeySchema,
  outcome: RealtimeResultOutcomeSchema,
  domain: z.string(),
  reference: z.string().nullable(),
  orderIndex: z.number().nullable(),
  timestamp: z.number(),
  duration: z.number().nullable(),
})

const RealtimeEventResultPayloadSchema = z.discriminatedUnion("outcome", [
  RealtimeEventResultPayloadBaseSchema.extend({
    outcome: z.literal("success"),
  }),
  RealtimeEventResultPayloadBaseSchema.extend({
    outcome: z.literal("error"),
    error: z.string(),
  }),
])

function createRealtimeEventScopedSchema<TSchema extends z.ZodTypeAny>(schema: TSchema) {
  return Object.fromEntries(
    realtimeEventKeys.map((eventKey) => [eventKey, schema]),
  ) as Record<(typeof realtimeEventKeys)[number], TSchema>
}

const realtimeContractSchema = {
  event: {
    result: createRealtimeEventScopedSchema(RealtimeEventResultPayloadSchema),
  },
} as const

export const realtime = new Realtime({ redis, schema: realtimeContractSchema })
export type RealtimeEvents = InferRealtimeEvents<typeof realtime>
