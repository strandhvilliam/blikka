import { z } from "zod"

export const rulesFormSchema = z.object({
  max_file_size: z.object({
    enabled: z.boolean(),
    severity: z.string(),
    params: z.object({
      maxBytes: z.number(),
    }),
  }),
  allowed_file_types: z.object({
    enabled: z.boolean(),
    severity: z.string(),
    params: z.object({
      allowedFileTypes: z.array(z.string()),
    }),
  }),
  strict_timestamp_ordering: z.object({
    enabled: z.boolean(),
    severity: z.string(),
    params: z.null(),
  }),
  same_device: z.object({
    enabled: z.boolean(),
    severity: z.string(),
    params: z.null(),
  }),
  within_timerange: z.object({
    enabled: z.boolean(),
    severity: z.string(),
    params: z.object({
      start: z.string(),
      end: z.string(),
    }),
  }),
  modified: z.object({
    enabled: z.boolean(),
    severity: z.string(),
    params: z.null(),
  }),
})

export type RulesFormValues = z.infer<typeof rulesFormSchema>

export const maxFileSizeParamsSchema = z.object({
  maxBytes: z.number(),
})
export type MaxFileSizeParams = z.infer<typeof maxFileSizeParamsSchema>

export const allowedFileTypesParamsSchema = z.object({
  allowedFileTypes: z.array(z.string()),
})
export type AllowedFileTypesParams = z.infer<typeof allowedFileTypesParamsSchema>

export const withinTimerangeParamsSchema = z.object({
  start: z.string(),
  end: z.string(),
})
export type WithinTimerangeParams = z.infer<typeof withinTimerangeParamsSchema>

export const sameDeviceParamsSchema = z.null()
export type SameDeviceParams = z.infer<typeof sameDeviceParamsSchema>

export const noModificationsParamsSchema = z.null()
export type NoModificationsParams = z.infer<typeof noModificationsParamsSchema>

export const strictTimestampOrderingParamsSchema = z.null()

export type StrictTimestampOrderingParams = z.infer<typeof strictTimestampOrderingParamsSchema>
