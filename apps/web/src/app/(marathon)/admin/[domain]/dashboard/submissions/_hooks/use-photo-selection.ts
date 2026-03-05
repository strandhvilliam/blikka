"use client"

import { useEffect, useRef, useState } from "react"
import { VALIDATION_OUTCOME, type ValidationResult } from "@blikka/validation"
import type { RuleConfig } from "@blikka/db"
import type { AdminSelectedPhoto } from "../_lib/types"
import { toast } from "sonner"
import {
  processSelectedFiles,
  reassignPhotoOrderIndexes,
  revokePhotoPreviewUrls,
} from "../_lib/file-processing"
import { runAdminPhotoValidation } from "../_lib/validation"

function createValidationResultKey(result: ValidationResult) {
  return [
    result.ruleKey,
    result.message,
    result.outcome,
    result.severity,
    result.orderIndex ?? "none",
    result.fileName ?? "none",
    result.isGeneral ? "general" : "file",
  ].join("|")
}

function splitValidationResultsBySeverity(results: ValidationResult[]) {
  const blocking: ValidationResult[] = []
  const warnings: ValidationResult[] = []
  for (const r of results) {
    if (r.outcome === VALIDATION_OUTCOME.FAILED) {
      if (r.severity === "error") {
        blocking.push(r)
      } else {
        warnings.push(r)
      }
    }
  }
  return { blocking, warnings }
}

function buildPhotoValidationMap(photos: AdminSelectedPhoto[], results: ValidationResult[]) {
  const map = new Map<string, ValidationResult[]>()
  for (const photo of photos) {
    const unique = new Map<string, ValidationResult>()
    for (const result of results) {
      if (result.isGeneral) continue
      const matchesOrder = result.orderIndex !== undefined && result.orderIndex === photo.orderIndex
      const matchesFileName = result.fileName === photo.file.name
      if (!matchesOrder && !matchesFileName) continue
      unique.set(createValidationResultKey(result), result)
    }
    map.set(photo.id, Array.from(unique.values()))
  }
  return map
}

interface UsePhotoSelectionInput {
  open: boolean
  topicOrderIndexes: number[]
  expectedPhotoCount: number
  ruleConfigs: RuleConfig[]
  marathonStartDate?: string | null
  marathonEndDate?: string | null
  isUploadBusy: boolean
  uploadComplete: boolean
  canSelectFiles: boolean
  onClearFormFilesError?: () => void
  onResetUploadState?: () => void
}

export function usePhotoSelection({
  open,
  topicOrderIndexes,
  expectedPhotoCount,
  ruleConfigs,
  marathonStartDate,
  marathonEndDate,
  isUploadBusy,
  uploadComplete,
  canSelectFiles,
  onClearFormFilesError,
  onResetUploadState,
}: UsePhotoSelectionInput) {
  const photosRef = useRef<AdminSelectedPhoto[]>([])

  const [selectedPhotos, setSelectedPhotos] = useState<AdminSelectedPhoto[]>([])
  const [isProcessingFiles, setIsProcessingFiles] = useState(false)
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([])
  const [validationRunError, setValidationRunError] = useState<string | null>(null)

  useEffect(() => {
    photosRef.current = selectedPhotos
  }, [selectedPhotos])

  useEffect(() => {
    return () => {
      revokePhotoPreviewUrls(photosRef.current)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!open) return

    if (selectedPhotos.length === 0) {
      setValidationResults([])
      setValidationRunError(null)
      return
    }

    const runValidation = async () => {
      try {
        const results = await runAdminPhotoValidation({
          photos: selectedPhotos,
          ruleConfigs,
          marathonStartDate,
          marathonEndDate,
        })

        if (cancelled) {
          return
        }

        setValidationResults(results)
        setValidationRunError(null)
      } catch (error) {
        if (cancelled) return

        const message =
          error instanceof Error ? error.message : "Failed to validate selected images"

        setValidationRunError(message)
        setValidationResults([])
      }
    }

    void runValidation()

    return () => {
      cancelled = true
    }
  }, [open, selectedPhotos, ruleConfigs, marathonStartDate, marathonEndDate])

  const generalValidationResults = validationResults.filter(
    (result) => result.isGeneral || (result.orderIndex === undefined && !result.fileName),
  )

  const photoValidationMap = buildPhotoValidationMap(selectedPhotos, validationResults)

  const { blocking: blockingValidationErrors, warnings: warningValidationResults } =
    splitValidationResultsBySeverity(validationResults)

  async function handleFileSelect(fileList: FileList | File[] | null) {
    if (isUploadBusy || uploadComplete || !canSelectFiles) return

    setIsProcessingFiles(true)
    onResetUploadState?.()

    try {
      const result = await processSelectedFiles({
        fileList,
        existingPhotos: selectedPhotos,
        maxPhotos: expectedPhotoCount,
        topicOrderIndexes,
      })

      if (result.errors.length > 0) {
        result.errors.forEach((message) => toast.error(message))
      }
      if (result.warnings.length > 0) {
        result.warnings.forEach((message) => toast.message(message))
      }
      if (result.photos !== selectedPhotos) {
        setSelectedPhotos(result.photos)
        onClearFormFilesError?.()
      }
    } finally {
      setIsProcessingFiles(false)
    }
  }

  function handleRemovePhoto(photoId: string) {
    if (isUploadBusy || uploadComplete) return
    onResetUploadState?.()
    setSelectedPhotos((current) => {
      const target = current.find((photo) => photo.id === photoId)
      if (target) URL.revokeObjectURL(target.previewUrl)
      const remaining = current.filter((photo) => photo.id !== photoId)
      return reassignPhotoOrderIndexes(remaining, topicOrderIndexes)
    })
  }

  function resetPhotoSelection() {
    setSelectedPhotos((current) => {
      revokePhotoPreviewUrls(current)
      return []
    })
    setValidationResults([])
    setValidationRunError(null)
    setIsProcessingFiles(false)
  }

  return {
    selectedPhotos,
    setSelectedPhotos,
    validationResults,
    validationRunError,
    isProcessingFiles,
    generalValidationResults,
    photoValidationMap,
    blockingValidationErrors,
    warningValidationResults,
    handleFileSelect,
    handleRemovePhoto,
    resetPhotoSelection,
  }
}
