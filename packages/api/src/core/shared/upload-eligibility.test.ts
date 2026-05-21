import { Option } from 'effect'
import { describe, expect, it } from 'vitest'
import type { ParticipantState, SubmissionState } from '@blikka/kv-store'

import { isSuccessfulActiveTopicUpload } from './upload-eligibility'

const uploadSessionId = 'upload-session-1'
const activeTopicOrderIndex = 2

const makeParticipantState = (overrides: Partial<ParticipantState> = {}): ParticipantState => ({
  uploadSessionId,
  expectedCount: 1,
  orderIndexes: [activeTopicOrderIndex],
  processedIndexes: [],
  validated: false,
  zipKey: '',
  contactSheetKey: '',
  errors: [],
  finalized: false,
  checkedAt: null,
  ...overrides,
})

const makeSubmissionState = (overrides: Partial<SubmissionState> = {}): SubmissionState => ({
  uploadSessionId,
  key: 'demo/REF123/02/photo.jpg',
  orderIndex: activeTopicOrderIndex,
  uploaded: false,
  thumbnailKey: null,
  exifProcessed: false,
  ...overrides,
})

describe('isSuccessfulActiveTopicUpload', () => {
  it('returns true when DB submission status is not initialized', () => {
    expect(
      isSuccessfulActiveTopicUpload({
        submissionStatus: 'uploaded',
        participantState: Option.none(),
        submissionState: Option.none(),
        activeTopicOrderIndex,
      }),
    ).toBe(true)
  })

  it('returns true when participant is finalized for the active topic order index', () => {
    expect(
      isSuccessfulActiveTopicUpload({
        submissionStatus: 'initialized',
        participantState: Option.some(
          makeParticipantState({
            finalized: true,
            orderIndexes: [activeTopicOrderIndex],
          }),
        ),
        submissionState: Option.none(),
        activeTopicOrderIndex,
      }),
    ).toBe(true)
  })

  it('returns true when KV submission is uploaded', () => {
    expect(
      isSuccessfulActiveTopicUpload({
        submissionStatus: 'initialized',
        participantState: Option.none(),
        submissionState: Option.some(makeSubmissionState({ uploaded: true })),
        activeTopicOrderIndex,
      }),
    ).toBe(true)
  })

  it('returns true when KV submission has exif processed', () => {
    expect(
      isSuccessfulActiveTopicUpload({
        submissionStatus: 'initialized',
        participantState: Option.none(),
        submissionState: Option.some(makeSubmissionState({ exifProcessed: true })),
        activeTopicOrderIndex,
      }),
    ).toBe(true)
  })

  it('returns true when KV submission has a thumbnail key', () => {
    expect(
      isSuccessfulActiveTopicUpload({
        submissionStatus: 'initialized',
        participantState: Option.none(),
        submissionState: Option.some(
          makeSubmissionState({ thumbnailKey: 'demo/REF123/02/thumbnail.jpg' }),
        ),
        activeTopicOrderIndex,
      }),
    ).toBe(true)
  })

  it('returns false when all checks are clear', () => {
    expect(
      isSuccessfulActiveTopicUpload({
        submissionStatus: 'initialized',
        participantState: Option.some(makeParticipantState()),
        submissionState: Option.some(makeSubmissionState()),
        activeTopicOrderIndex,
      }),
    ).toBe(false)
  })
})
