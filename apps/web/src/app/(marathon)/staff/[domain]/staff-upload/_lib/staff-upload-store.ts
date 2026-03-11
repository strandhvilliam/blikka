"use client"

import { create, type StateCreator } from "zustand"
import type { ValidationResult } from "@blikka/validation"
import type { ParticipantFormValues } from "@/lib/participant-upload/participant-form-schema"
import type {
  ParticipantSelectedPhoto,
  ParticipantUploadError,
  ParticipantUploadFileState,
  ParticipantUploadPhase,
} from "@/lib/participant-upload/types"
import {
  reassignPhotoOrderIndexes,
  revokePhotoPreviewUrls,
} from "@/lib/participant-upload/file-processing"
import { type ParticipantExistenceStatus } from "@/lib/participant-upload/flow-helpers"
import type { StaffParticipant } from "../../_lib/staff-types"
import {
  STAFF_UPLOAD_DEFAULT_FORM_VALUES,
  type StaffUploadFormErrors,
} from "./staff-upload-form"

interface ParticipantState {
  formValues: ParticipantFormValues
  formErrors: StaffUploadFormErrors
  lookupErrorMessage: string | null
  existingParticipant: StaffParticipant | null
  participantStatus: ParticipantExistenceStatus
  showOverwriteDialog: boolean
}

interface ParticipantActions {
  resetForm: (reference?: string) => void
  setFormField: <TKey extends keyof ParticipantFormValues>(
    key: TKey,
    value: ParticipantFormValues[TKey],
  ) => void
  setFormErrors: (errors: StaffUploadFormErrors) => void
  clearFormErrors: () => void
  patchParticipant: (patch: Partial<ParticipantState>) => void
}

type ParticipantSlice = ParticipantState & ParticipantActions

function initialParticipantState(): ParticipantState {
  return {
    formValues: STAFF_UPLOAD_DEFAULT_FORM_VALUES,
    formErrors: {},
    lookupErrorMessage: null,
    existingParticipant: null,
    participantStatus: null,
    showOverwriteDialog: false,
  }
}

const createParticipantSlice: StateCreator<
  StaffUploadStore,
  [],
  [],
  ParticipantSlice
> = (set, get) => ({
  ...initialParticipantState(),
  resetForm: (reference = "") => {
    set({
      formValues: { ...STAFF_UPLOAD_DEFAULT_FORM_VALUES, reference },
      formErrors: {},
    })
  },
  setFormField: (key, value) => {
    const state = get()
    const shouldResetPhotoSession =
      key === "competitionClassId" &&
      value !== state.formValues.competitionClassId &&
      state.selectedPhotos.length > 0

    if (shouldResetPhotoSession) {
      revokePhotoPreviewUrls(state.selectedPhotos)
    }

    set((prev) => ({
      formValues: { ...prev.formValues, [key]: value },
      formErrors: { ...prev.formErrors, [key]: undefined },
      ...(shouldResetPhotoSession
        ? { ...initialPhotoState(), ...initialUploadState() }
        : {}),
    }))
  },
  setFormErrors: (errors) => set({ formErrors: errors }),
  clearFormErrors: () => set({ formErrors: {} }),
  patchParticipant: (patch) => set(patch),
})

interface PhotoState {
  selectedPhotos: ParticipantSelectedPhoto[]
  validationResults: ValidationResult[]
  validationRunError: string | null
  isProcessingFiles: boolean
  filesError: string | null
}

interface PhotoActions {
  setSelectedPhotos: (photos: ParticipantSelectedPhoto[]) => void
  removeSelectedPhoto: (photoId: string, topicOrderIndexes: number[]) => void
  resetPhotoSelection: () => void
  patchPhotos: (patch: Partial<PhotoState>) => void
}

type PhotoSlice = PhotoState & PhotoActions

function initialPhotoState(): PhotoState {
  return {
    selectedPhotos: [],
    validationResults: [],
    validationRunError: null,
    isProcessingFiles: false,
    filesError: null,
  }
}

const createPhotoSlice: StateCreator<
  StaffUploadStore,
  [],
  [],
  PhotoSlice
> = (set, get) => ({
  ...initialPhotoState(),
  setSelectedPhotos: (photos) => set({ selectedPhotos: photos }),
  removeSelectedPhoto: (photoId, topicOrderIndexes) => {
    set((state) => {
      const target = state.selectedPhotos.find((p) => p.id === photoId)
      if (target) URL.revokeObjectURL(target.previewUrl)

      return {
        selectedPhotos: reassignPhotoOrderIndexes(
          state.selectedPhotos.filter((p) => p.id !== photoId),
          topicOrderIndexes,
        ),
      }
    })
  },
  resetPhotoSelection: () => {
    revokePhotoPreviewUrls(get().selectedPhotos)
    set(initialPhotoState())
  },
  patchPhotos: (patch) => set(patch),
})

interface UploadState {
  uploadFiles: ParticipantUploadFileState[]
  submittedReference: string
  isUploadingFiles: boolean
  isPollingStatus: boolean
  uploadErrorMessage: string | null
  uploadComplete: boolean
  isSavingLocally: boolean
}

interface UploadActions {
  updateUploadFileState: (
    key: string,
    patch: Partial<
      Pick<ParticipantUploadFileState, "phase" | "progress" | "error">
    >,
  ) => void
  resetUploadFlow: () => void
  patchUpload: (patch: Partial<UploadState>) => void
}

type UploadSlice = UploadState & UploadActions

function initialUploadState(): UploadState {
  return {
    uploadFiles: [],
    submittedReference: "",
    isUploadingFiles: false,
    isPollingStatus: false,
    uploadErrorMessage: null,
    uploadComplete: false,
    isSavingLocally: false,
  }
}

const createUploadSlice: StateCreator<
  StaffUploadStore,
  [],
  [],
  UploadSlice
> = (set) => ({
  ...initialUploadState(),

  updateUploadFileState: (key, patch) => {
    set((state) => ({
      uploadFiles: state.uploadFiles.map((file) =>
        file.key === key
          ? {
            ...file,
            ...patch,
            phase: (patch.phase ?? file.phase) as ParticipantUploadPhase,
            progress: patch.progress ?? file.progress,
            error:
              patch.phase === "error"
                ? (patch.error as ParticipantUploadError | undefined)
                : (patch.error ?? file.error),
          }
          : file,
      ),
    }))
  },
  resetUploadFlow: () => set(initialUploadState()),
  patchUpload: (patch) => set(patch),
})

interface SharedSlice {
  resetAllState: () => void
}

const createSharedSlice: StateCreator<
  StaffUploadStore,
  [],
  [],
  SharedSlice
> = (set, get) => ({
  resetAllState: () => {
    revokePhotoPreviewUrls(get().selectedPhotos)
    set({
      ...initialParticipantState(),
      ...initialPhotoState(),
      ...initialUploadState(),
    })
  },
})

export type StaffUploadStore = ParticipantSlice &
  PhotoSlice &
  UploadSlice &
  SharedSlice

export const useStaffUploadStore = create<StaffUploadStore>()((...a) => ({
  ...createParticipantSlice(...a),
  ...createPhotoSlice(...a),
  ...createUploadSlice(...a),
  ...createSharedSlice(...a),
}))

export const selectRequiresOverwriteWarning = (s: StaffUploadStore) =>
  s.participantStatus === "initialized"
