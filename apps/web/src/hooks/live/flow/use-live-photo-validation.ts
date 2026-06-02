'use client'

import { useEffect, useState } from 'react'
import type { RuleConfig } from '@blikka/db'
import { runParticipantPhotoValidation } from '@/lib/participant-photo-validation'
import type { UploadMarathonMode } from '@/lib/types'
import { usePhotoStore } from '@/lib/flow/photo-store'

interface UseLivePhotoValidationOptions {
  ruleConfigs: RuleConfig[]
  validationStartDate?: string | Date | null
  validationEndDate?: string | Date | null
  marathonMode: UploadMarathonMode
}

export function useLivePhotoValidation({
  ruleConfigs,
  validationStartDate,
  validationEndDate,
  marathonMode,
}: UseLivePhotoValidationOptions) {
  const photos = usePhotoStore((state) => state.photos)
  const setValidationResults = usePhotoStore((state) => state.setValidationResults)
  const [isValidationRunning, setIsValidationRunning] = useState(false)

  useEffect(() => {
    let cancelled = false

    if (photos.length === 0) {
      setValidationResults([])
      setIsValidationRunning(false)
      return
    }

    setIsValidationRunning(true)

    const runValidation = async () => {
      try {
        const results = await runParticipantPhotoValidation({
          photos,
          ruleConfigs,
          marathonStartDate: validationStartDate,
          marathonEndDate: validationEndDate,
          marathonMode,
        })

        if (!cancelled) {
          setValidationResults(results)
          setIsValidationRunning(false)
        }
      } catch (error) {
        console.error('Live photo validation failed:', error)

        if (!cancelled) {
          setValidationResults([])
          setIsValidationRunning(false)
        }
      }
    }

    void runValidation()

    return () => {
      cancelled = true
    }
  }, [
    validationEndDate,
    validationStartDate,
    marathonMode,
    photos,
    ruleConfigs,
    setValidationResults,
  ])

  return { isValidationRunning }
}
