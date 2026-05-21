import { Cause, Effect, Exit, Option } from 'effect'
import type { CompetitionClass } from '@blikka/db'
import type { ParticipantState } from '@blikka/kv-store'
import { describe, expect, it } from 'vitest'

import { BadRequestError } from '../errors'
import {
  ensureDeviceGroupExists,
  encryptOptionalPhoneNumber,
  getCompetitionClassOrFail,
  isParticipantFinalized,
  normalizeUploadContentType,
  staleOrderIndexesFromParticipantState,
} from './upload'
import type { PhoneNumberEncryptionService } from '../utils/phone-number-encryption'

const domain = 'demo'

const runEffect = <A, E>(effect: Effect.Effect<A, E>) => Effect.runSyncExit(effect)

describe('normalizeUploadContentType', () => {
  it('defaults empty and image/jpg to image/jpeg', () => {
    expect(normalizeUploadContentType(null)).toBe('image/jpeg')
    expect(normalizeUploadContentType('')).toBe('image/jpeg')
    expect(normalizeUploadContentType('image/jpg')).toBe('image/jpeg')
  })

  it('preserves allowed content types', () => {
    expect(normalizeUploadContentType('image/png')).toBe('image/png')
    expect(normalizeUploadContentType('IMAGE/WEBP')).toBe('image/webp')
  })

  it('falls back unknown types to image/jpeg', () => {
    expect(normalizeUploadContentType('application/pdf')).toBe('image/jpeg')
  })
})

describe('isParticipantFinalized', () => {
  it('returns true for completed and verified statuses', () => {
    expect(isParticipantFinalized('completed')).toBe(true)
    expect(isParticipantFinalized('verified')).toBe(true)
  })

  it('returns false for other statuses', () => {
    expect(isParticipantFinalized('prepared')).toBe(false)
    expect(isParticipantFinalized('uploading')).toBe(false)
  })
})

describe('staleOrderIndexesFromParticipantState', () => {
  it('returns order indexes when state is present', () => {
    const state: ParticipantState = {
      uploadSessionId: 'session-1',
      expectedCount: 1,
      orderIndexes: [0, 2],
      processedIndexes: [],
      validated: false,
      zipKey: '',
      contactSheetKey: '',
      errors: [],
      finalized: false,
      checkedAt: null,
    }

    expect(staleOrderIndexesFromParticipantState(Option.some(state))).toEqual([0, 2])
  })

  it('returns an empty array when state is missing', () => {
    expect(staleOrderIndexesFromParticipantState(Option.none())).toEqual([])
  })
})

describe('ensureDeviceGroupExists', () => {
  it('returns the matching device group', () => {
    const exit = runEffect(
      ensureDeviceGroupExists({
        domain,
        marathon: { deviceGroups: [{ id: 7 }, { id: 8 }] },
        deviceGroupId: 7,
      }),
    )

    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toEqual({ id: 7 })
    }
  })

  it('fails when the device group is missing', () => {
    const exit = runEffect(
      ensureDeviceGroupExists({
        domain,
        marathon: { deviceGroups: [{ id: 7 }] },
        deviceGroupId: 99,
      }),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const error = Cause.squash(exit.cause)
      expect(error).toBeInstanceOf(BadRequestError)
      if (error instanceof BadRequestError) {
        expect(error.message).toContain(domain)
      }
    }
  })
})

describe('getCompetitionClassOrFail', () => {
  const competitionClass = { id: 5 } as CompetitionClass

  it('returns the matching competition class', () => {
    const exit = runEffect(
      getCompetitionClassOrFail({
        domain,
        marathon: { competitionClasses: [competitionClass] },
        competitionClassId: 5,
      }),
    )

    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toBe(competitionClass)
    }
  })

  it('fails when the competition class is missing', () => {
    const exit = runEffect(
      getCompetitionClassOrFail({
        domain,
        marathon: { competitionClasses: [] },
        competitionClassId: 5,
      }),
    )

    expect(Exit.isFailure(exit)).toBe(true)
  })
})

describe('encryptOptionalPhoneNumber', () => {
  const phoneEncryption = {
    encrypt: ({ phoneNumber }: { phoneNumber: string }) =>
      Effect.succeed({
        encrypted: `enc:${phoneNumber}`,
        hash: `hash:${phoneNumber}`,
      }),
  } as unknown as PhoneNumberEncryptionService['Service']

  it('encrypts a provided phone number', () => {
    const exit = runEffect(encryptOptionalPhoneNumber(phoneEncryption, '+4712345678'))

    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toEqual({
        encrypted: 'enc:+4712345678',
        hash: 'hash:+4712345678',
      })
    }
  })

  it('returns null values for missing phone numbers', () => {
    const exit = runEffect(encryptOptionalPhoneNumber(phoneEncryption, '   '))

    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toEqual({ encrypted: null, hash: null })
    }
  })
})
