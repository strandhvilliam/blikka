import type { ValidationResult } from '@blikka/validation'
import {
  createParticipantFormSchema,
  type ParticipantFormValues,
} from '@/lib/participant-form-schema'
import { hasBlockingValidationErrors } from '@/lib/participant-photo-validation'

export const STAFF_UPLOAD_DEFAULT_FORM_VALUES: ParticipantFormValues = {
  reference: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  competitionClassId: '',
  deviceGroupId: '',
}

export type StaffUploadFormErrors = Partial<Record<keyof ParticipantFormValues, string>>

export function validateStaffUploadForm(marathonMode: string, values: ParticipantFormValues) {
  const result = createParticipantFormSchema(marathonMode, {
    staffByCameraManual: marathonMode === 'by-camera',
  }).safeParse(values)

  if (result.success) return null

  const errors: StaffUploadFormErrors = {}

  for (const issue of result.error.issues) {
    const path = issue.path[0]
    if (typeof path === 'string' && !errors[path as keyof ParticipantFormValues]) {
      errors[path as keyof ParticipantFormValues] = issue.message
    }
  }

  return errors
}

function pluralizePhotos(count: number) {
  return `${count} photo${count === 1 ? '' : 's'}`
}

interface StaffUploadGateContext {
  /** A run already in flight: the submit button is disabled, but there is nothing to tell staff to fix. */
  isBusy: boolean
  marathonMode?: string
  /** Manually entered participants need staff to confirm terms acceptance on their behalf. */
  termsRequired: boolean
  termsAccepted: boolean
  expectedPhotoCount: number
  selectedPhotosCount: number
  validationResults: ValidationResult[]
  validationRunError: string | null
}

export interface StaffUploadGate {
  /** Whether the upload may start. Drives the submit button's disabled state. */
  blocked: boolean
  /** What staff must fix, or null when blocked for a reason they cannot act on (a run in flight). */
  reason: string | null
}

/**
 * The single answer to "can this upload start, and if not why". The submit button's disabled
 * state, the hint above it, and the submit handler all read this, so a button that looks live
 * can never be rejected on click — and a stated reason always matches a disabled button.
 */
export function resolveStaffUploadGate(context: StaffUploadGateContext): StaffUploadGate {
  const {
    isBusy,
    marathonMode,
    termsRequired,
    termsAccepted,
    expectedPhotoCount,
    selectedPhotosCount,
    validationResults,
    validationRunError,
  } = context

  if (isBusy) {
    return { blocked: true, reason: null }
  }

  if (expectedPhotoCount <= 0) {
    return {
      blocked: true,
      reason:
        marathonMode === 'by-camera'
          ? 'No active topic is available for uploads. Activate a topic in the dashboard first.'
          : 'Select a competition class before adding images.',
    }
  }

  if (selectedPhotosCount !== expectedPhotoCount) {
    return { blocked: true, reason: `Select exactly ${pluralizePhotos(expectedPhotoCount)}.` }
  }

  if (validationRunError) {
    return { blocked: true, reason: 'Validation failed. Reselect files and try again.' }
  }

  if (hasBlockingValidationErrors(validationResults)) {
    return { blocked: true, reason: 'Resolve blocking validation issues before uploading.' }
  }

  if (termsRequired && !termsAccepted) {
    return {
      blocked: true,
      reason: 'Confirm the participant accepted the terms before uploading.',
    }
  }

  return { blocked: false, reason: null }
}
