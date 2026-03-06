import "server-only"

import { Realtime, InferRealtimeEvents } from "@upstash/realtime"
import z from "zod/v4"
import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

const schema = {
  '*': z.any(),
}


export const realtime = new Realtime({ redis, schema })
export type RealtimeEvents = InferRealtimeEvents<typeof realtime>