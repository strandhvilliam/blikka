import { describe, expect, it } from 'vitest'

import { pollRateLimitIdentifier } from './poll-rate-limit'

describe('pollRateLimitIdentifier', () => {
  it('buckets on the domain and reference pair', () => {
    expect(pollRateLimitIdentifier({ domain: 'demo', reference: 'AB12' })).toBe('demo:AB12')
  })

  it('keeps references in separate buckets within a domain', () => {
    expect(pollRateLimitIdentifier({ domain: 'demo', reference: 'AB12' })).not.toBe(
      pollRateLimitIdentifier({ domain: 'demo', reference: 'CD34' }),
    )
  })

  it('keeps domains apart for a shared reference', () => {
    expect(pollRateLimitIdentifier({ domain: 'demo', reference: 'AB12' })).not.toBe(
      pollRateLimitIdentifier({ domain: 'other', reference: 'AB12' }),
    )
  })

  it('returns null when the input carries no reference to key on', () => {
    expect(pollRateLimitIdentifier({ domain: 'demo' })).toBeNull()
    expect(pollRateLimitIdentifier({ reference: 'AB12' })).toBeNull()
    expect(pollRateLimitIdentifier({ domain: 'demo', reference: '' })).toBeNull()
    expect(pollRateLimitIdentifier({ domain: 'demo', reference: 42 })).toBeNull()
    expect(pollRateLimitIdentifier(null)).toBeNull()
    expect(pollRateLimitIdentifier('demo')).toBeNull()
  })

  it('bounds the key so an oversized input cannot grow the Redis keyspace', () => {
    const identifier = pollRateLimitIdentifier({
      domain: 'd'.repeat(500),
      reference: 'r'.repeat(500),
    })

    expect(identifier).toBe(`${'d'.repeat(64)}:${'r'.repeat(64)}`)
  })
})
