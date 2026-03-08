import "server-only"

import { Realtime, InferRealtimeEvents } from "@upstash/realtime"
import z from "zod/v4"
import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

export const TASK_NAME = {
  UPLOAD_INITIALIZER: "upload-initializer",
  UPLOAD_PROCESSOR: "upload-processor",
  UPLOAD_FINALIZER: "upload-finalizer",
  CONTACT_SHEET_GENERATOR: "contact-sheet-generator",
  ZIP_WORKER: "zip-worker",
  VALIDATION_RUNNER: "validation-runner",
} as const

export type TaskName = (typeof TASK_NAME)[keyof typeof TASK_NAME]

const schema = {
  task: {
    start: z.string(),
    end: z.string(),
    error: z.string(),
  }
}

export const realtime = new Realtime({ redis, schema })
export type RealtimeEvents = InferRealtimeEvents<typeof realtime>
