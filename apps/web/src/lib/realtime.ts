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

const taskNames = Object.values(TASK_NAME) as [TaskName, ...TaskName[]]
const TaskNameSchema = z.enum(taskNames)

const TaskStartPayloadSchema = z.object({
  taskName: TaskNameSchema,
  domain: z.string(),
  reference: z.string(),
  orderIndex: z.number().nullable(),
  timestamp: z.number(),
})

const TaskEndPayloadSchema = z.object({
  taskName: TaskNameSchema,
  domain: z.string(),
  reference: z.string(),
  orderIndex: z.number().nullable(),
  timestamp: z.number(),
  duration: z.number(),
})

const TaskErrorPayloadSchema = z.object({
  taskName: TaskNameSchema,
  domain: z.string(),
  reference: z.string(),
  orderIndex: z.number().nullable(),
  timestamp: z.number(),
  duration: z.number(),
  error: z.string(),
})

function createTaskScopedSchema<TSchema extends z.ZodTypeAny>(schema: TSchema) {
  return Object.fromEntries(
    taskNames.map((taskName) => [taskName, schema]),
  ) as Record<TaskName, TSchema>
}

const schema = {
  task: {
    start: createTaskScopedSchema(TaskStartPayloadSchema),
    end: createTaskScopedSchema(TaskEndPayloadSchema),
    error: createTaskScopedSchema(TaskErrorPayloadSchema),
  },
}

export const realtime = new Realtime({ redis, schema })
export type RealtimeEvents = InferRealtimeEvents<typeof realtime>
