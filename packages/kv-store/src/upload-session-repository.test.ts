import { assert, describe, it } from '@effect/vitest'
import { Option, Schema } from 'effect'

import { ParticipantStateSchema } from './upload-session-repository'

describe('ParticipantStateSchema', () => {
  it('decodes older redis participant state without validation decision fields', () => {
    const decoded = Schema.decodeUnknownOption(ParticipantStateSchema)({
      uploadSessionId: 'session-1',
      expectedCount: 1,
      orderIndexes: [0],
      processedIndexes: [1],
      validated: false,
      zipKey: '',
      contactSheetKey: '',
      errors: [],
      finalized: true,
      checkedAt: null,
    })

    assert.isTrue(Option.isSome(decoded))

    if (Option.isSome(decoded)) {
      assert.strictEqual(decoded.value.validationDecision, undefined)
      assert.strictEqual(decoded.value.validatedAt, undefined)
    }
  })
})
