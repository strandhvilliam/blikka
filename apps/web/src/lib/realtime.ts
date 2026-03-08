import "server-only"

import { Realtime, InferRealtimeEvents } from "@upstash/realtime"
import z from "zod/v4"
import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

const schema = {
  "task.start": z.object({
    taskName: z.string(),
    domain: z.string(),
    reference: z.string(),
    orderIndex: z.number().nullable(),
    timestamp: z.number(),
  }),
  "task.end": z.object({
    taskName: z.string(),
    domain: z.string(),
    reference: z.string(),
    orderIndex: z.number().nullable(),
    timestamp: z.number(),
    duration: z.number(),
  }),
  "task.error": z.object({
    taskName: z.string(),
    domain: z.string(),
    reference: z.string(),
    orderIndex: z.number().nullable(),
    timestamp: z.number(),
    duration: z.number(),
    error: z.string(),
  }),
}

export const realtime = new Realtime({ redis, schema })
export type RealtimeEvents = InferRealtimeEvents<typeof realtime>
