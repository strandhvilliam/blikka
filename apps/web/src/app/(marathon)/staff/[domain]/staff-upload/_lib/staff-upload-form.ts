import type { ValidationResult } from "@blikka/validation"
import {
  createParticipantFormSchema,
  type ParticipantFormValues,
} from "@/lib/participant-form-schema"
import { hasBlockingValidationErrors } from "@/lib/participant-photo-validation"

export const STAFF_UPLOAD_DEFAULT_FORM_VALUES: ParticipantFormValues = {
  reference: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  competitionClassId: "",
  deviceGroupId: "",
}

export type StaffUploadFormErrors = Partial<Record<keyof ParticipantFormValues, string>>

interface ValidateFilesContext {
  expectedPhotoCount: number
  selectedPhotosCount: number
  validationResults: ValidationResult[]
  validationRunError: string | null
}

export function validateStaffUploadForm(marathonMode: string, values: ParticipantFormValues) {
  const result = createParticipantFormSchema(marathonMode).safeParse(values)

  if (result.success) return null

  const errors: StaffUploadFormErrors = {}

  for (const issue of result.error.issues) {
    const path = issue.path[0]
    if (typeof path === "string" && !errors[path as keyof ParticipantFormValues]) {
      errors[path as keyof ParticipantFormValues] = issue.message
    }
  }

  return errors
}

function pluralizePhotos(count: number) {
  return `${count} photo${count === 1 ? "" : "s"}`
}

export function validateStaffUploadFiles(context: ValidateFilesContext) {
  const { expectedPhotoCount, selectedPhotosCount, validationResults, validationRunError } = context

  if (expectedPhotoCount === 0) {
    return "Select a competition class before adding images"
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
