import { describe, expect, it } from 'vitest'

import { parseJobIdsField } from './download-state-repository'

describe('parseJobIdsField', () => {
  it('parses a JSON array string', () => {
    expect(parseJobIdsField('["job-a","job-b"]')).toEqual(['job-a', 'job-b'])
  })

  it('parses a native array from redis clients that auto-decode JSON', () => {
    expect(parseJobIdsField(['408589e9-88bb-4a12-9659-112b5c42fad4'])).toEqual([
      '408589e9-88bb-4a12-9659-112b5c42fad4',
    ])
  })

  it('parses comma-separated legacy values', () => {
    expect(parseJobIdsField('job-a,job-b')).toEqual(['job-a', 'job-b'])
  })

  it('returns an empty array for empty values', () => {
    expect(parseJobIdsField(null)).toEqual([])
    expect(parseJobIdsField('')).toEqual([])
  })
})
