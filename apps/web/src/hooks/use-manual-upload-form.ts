"use client"

import { useForm, useStore } from "@tanstack/react-form"
import type { ValidationResult } from "@blikka/validation"
import { hasBlockingValidationErrors } from "@/lib/participant-photo-validation"
import {
  createParticipantFormSchema,
  type ParticipantFormValues,
} from "@/lib/participant-form-schema"

export type FormState = ParticipantFormValues
export type FormErrors = Partial<Record<keyof FormState | "files", string>>

export type ManualUploadFormApi = ReturnType<typeof useManualUploadForm>["form"]

export const DEFAULT_FORM_VALUES: FormState = {
  reference: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  competitionClassId: "",
  deviceGroupId: "",
}

export function pluralizePhotos(count: number) {
  return `${count} photo${count === 1 ? "" : "s"}`
}

interface ValidateFilesContext {
  expectedPhotoCount: number
  selectedPhotosCount: number
  validationResults: ValidationResult[]
  validationRunError: string | null
}

interface UseManualUploadFormOptions {
  onSubmit?: (value: ParticipantFormValues) => Promise<void>
}

export function useManualUploadForm(marathonMode: string, options?: UseManualUploadFormOptions) {
  const schema = createParticipantFormSchema(marathonMode)

  const parseFormValues = (value: ParticipantFormValues) => {
    return schema.safeParse(value)
  }

  const form = useForm({
    defaultValues: DEFAULT_FORM_VALUES,
    validators: {
      onSubmit: ({ value }) => {
        const result = parseFormValues(value)
        if (!result.success) {
          const fields: Record<string, string> = {}
          for (const issue of result.error.issues) {
            const path = issue.path[0]
            if (typeof path === "string" && !fields[path]) {
              fields[path] = issue.message
            }
          }
          return { fields: Object.keys(fields).length > 0 ? fields : undefined }
        }
        return undefined
      },
    },
    onSubmit: async ({ value }) => {
      const result = parseFormValues(value)
      if (!result.success) {
        return
      }
      await options?.onSubmit?.(result.data)
    },
  })

  const validateFiles = (context: ValidateFilesContext): string | null => {
    const { expectedPhotoCount, selectedPhotosCount, validationResults, validationRunError } =
      context

    if (expectedPhotoCount === 0) {
      return marathonMode === "marathon"
        ? "Select a competition class before adding images"
        : "No active topic available for by-camera upload"
    }
    if (selectedPhotosCount !== expectedPhotoCount) {
      return `Select exactly ${pluralizePhotos(expectedPhotoCount)}`
    }
    if (validationRunError) {
      return "Validation failed. Please reselect files and try again"
    }
    if (hasBlockingValidationErrors(validationResults)) {
      return "Resolve blocking validation errors before uploading"
    }
    return null
  }

  const resetForm = () => {
    form.reset()
  }

  const formValues = useStore(form.store, (state) => state.values)

  return {
    form,
    formValues,
    validateFiles,
    resetForm,
  }
}
