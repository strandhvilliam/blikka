'use client'

import { useCallback } from 'react'
import { useDebounce } from 'use-debounce'
import { useQueryStates } from 'nuqs'
import { submissionSearchParams } from '../_lib/search-params'
import { normalizeIdArray } from '../_lib/submissions-utils'

const SEARCH_DEBOUNCE_MS = 300

function parseMultiSelectValue(value: string): number[] | null {
  return value === 'all' ? null : value.split(',').map(Number)
}

export function useSubmissionsQueryState() {
  const [queryState, setQueryState] = useQueryStates(submissionSearchParams, {
    history: 'push',
  })

  const { search, competitionClassId, deviceGroupId } = queryState
  const [debouncedSearch] = useDebounce(search ?? '', SEARCH_DEBOUNCE_MS)

  const normalizedCompetitionClassId = normalizeIdArray(competitionClassId)
  const normalizedDeviceGroupId = normalizeIdArray(deviceGroupId)

  const handleCompetitionClassChange = useCallback(
    (value: string) => {
      setQueryState({ competitionClassId: parseMultiSelectValue(value) })
    },
    [setQueryState],
  )

  const handleDeviceGroupChange = useCallback(
    (value: string) => {
      setQueryState({ deviceGroupId: parseMultiSelectValue(value) })
    },
    [setQueryState],
  )

  return {
    queryState,
    setQueryState,
    debouncedSearch,
    normalizedCompetitionClassId,
    normalizedDeviceGroupId,
    handleCompetitionClassChange,
    handleDeviceGroupChange,
  }
}
