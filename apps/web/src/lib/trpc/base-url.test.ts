import { describe, expect, it } from 'vitest'

import { requestOriginFromHeaders, resolveTrpcBaseUrl } from './base-url'

describe('requestOriginFromHeaders', () => {
  it('uses the public origin forwarded by Vercel', () => {
    const headers = new Headers({
      host: 'blikka-git-main-team.vercel.app',
      'x-forwarded-host': 'sthlmbycamera.blikka.app',
      'x-forwarded-proto': 'https',
    })

    expect(requestOriginFromHeaders(headers)).toBe('https://sthlmbycamera.blikka.app')
  })

  it('uses http for local requests without a forwarded protocol', () => {
    expect(requestOriginFromHeaders(new Headers({ host: 'localhost:3002' }))).toBe(
      'http://localhost:3002',
    )
  })
})

describe('resolveTrpcBaseUrl', () => {
  it('uses the incoming request origin during server rendering', () => {
    expect(
      resolveTrpcBaseUrl({
        browserOrigin: null,
        requestOrigin: 'https://sthlmbycamera.blikka.app',
        port: '3000',
      }),
    ).toBe('https://sthlmbycamera.blikka.app')
  })

  it('uses the browser origin after hydration', () => {
    expect(
      resolveTrpcBaseUrl({
        browserOrigin: 'https://another-event.blikka.app',
        requestOrigin: 'https://sthlmbycamera.blikka.app',
        port: '3000',
      }),
    ).toBe('https://another-event.blikka.app')
  })
})
