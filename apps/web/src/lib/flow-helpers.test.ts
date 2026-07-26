import { describe, expect, it } from 'vitest'

import {
  resolveParticipantNumberDialogKind,
  resolveStaffLaptopUploadLookupOutcome,
} from './flow-helpers'

describe('participant-upload flow helpers', () => {
  it('routes missing participants to manual entry', () => {
    expect(
      resolveStaffLaptopUploadLookupOutcome({
        exists: false,
        status: null,
      }),
    ).toEqual({ kind: 'manual-entry' })
  })

  it('routes prepared participants to the existing-participant path', () => {
    expect(
      resolveStaffLaptopUploadLookupOutcome({
        exists: true,
        status: 'prepared',
      }),
    ).toEqual({
      kind: 'existing',
      requiresOverwriteWarning: false,
    })
  })

  it('marks initialized participants for overwrite confirmation', () => {
    expect(
      resolveStaffLaptopUploadLookupOutcome({
        exists: true,
        status: 'initialized',
      }),
    ).toEqual({
      kind: 'existing',
      requiresOverwriteWarning: true,
    })
  })

  it('blocks completed and verified participants', () => {
    expect(
      resolveStaffLaptopUploadLookupOutcome({
        exists: true,
        status: 'completed',
      }),
    ).toEqual({
      kind: 'blocked',
      reason: 'completed',
    })

    expect(
      resolveStaffLaptopUploadLookupOutcome({
        exists: true,
        status: 'verified',
      }),
    ).toEqual({
      kind: 'blocked',
      reason: 'verified',
    })
  })
})

describe('resolveParticipantNumberDialogKind', () => {
  it('warns about replacing a finished upload in the upload flow', () => {
    expect(resolveParticipantNumberDialogKind({ flowVariant: 'upload', status: 'completed' })).toBe(
      'replace-upload',
    )
    expect(resolveParticipantNumberDialogKind({ flowVariant: 'upload', status: 'verified' })).toBe(
      'replace-upload',
    )
  })

  it('warns instead of blocking when preparing over a finished upload', () => {
    expect(resolveParticipantNumberDialogKind({ flowVariant: 'prepare', status: 'completed' })).toBe(
      'replace-prepared-upload',
    )
    expect(resolveParticipantNumberDialogKind({ flowVariant: 'prepare', status: 'verified' })).toBe(
      'replace-prepared-upload',
    )
  })

  it('warns instead of blocking when preparing over an upload in progress', () => {
    expect(
      resolveParticipantNumberDialogKind({ flowVariant: 'prepare', status: 'initialized' }),
    ).toBe('replace-in-progress')
  })

  it('treats re-preparing a prepared registration as a plain update', () => {
    expect(resolveParticipantNumberDialogKind({ flowVariant: 'prepare', status: 'prepared' })).toBe(
      'update-registration',
    )
  })

  it('keeps the non-destructive continue copy for the upload flow', () => {
    expect(resolveParticipantNumberDialogKind({ flowVariant: 'upload', status: 'prepared' })).toBe(
      'continue-prepared',
    )
    expect(
      resolveParticipantNumberDialogKind({ flowVariant: 'upload', status: 'initialized' }),
    ).toBe('continue-existing')
  })
})
