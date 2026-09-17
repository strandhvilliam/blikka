import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConfigProvider, Effect } from 'effect'
import { SMSService } from './sms-contract'
import { TwilioSMSServiceLayer } from './twilio-sms-service'

const fetchMock = vi.fn()
const send = () =>
  Effect.runPromise(
    SMSService.use((sms) =>
      sms.send({ phoneNumber: '+46700000000', message: 'Voting invite' }),
    ).pipe(
      Effect.provide(TwilioSMSServiceLayer),
      Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ ...process.env }))),
    ),
  )

beforeEach(() => {
  vi.stubEnv('TWILIO_ACCOUNT_SID', 'ACtest')
  vi.stubEnv('TWILIO_API_KEY_SID', 'SKtest')
  vi.stubEnv('TWILIO_API_KEY_SECRET', 'test-secret')
  vi.stubEnv('TWILIO_MESSAGING_SERVICE_SID', 'MGtest')
  vi.stubEnv('TWILIO_REGION', undefined)
  fetchMock.mockReset().mockResolvedValue(Response.json({ sid: 'SMtest' }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('Twilio regional authentication', () => {
  it('sends through Ireland by default with the configured API key and service', async () => {
    await send()
    const [url, options] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://api.dublin.ie1.twilio.com/2010-04-01/Accounts/ACtest/Messages.json')
    expect(options.headers.Authorization).toBe(
      `Basic ${Buffer.from('SKtest:test-secret').toString('base64')}`,
    )
    expect(options.body.get('MessagingServiceSid')).toBe('MGtest')
  })

  it('supports explicitly selecting US1 for US credentials', async () => {
    vi.stubEnv('TWILIO_REGION', 'us1')
    await send()
    expect(fetchMock.mock.calls[0]![0]).toBe(
      'https://api.twilio.com/2010-04-01/Accounts/ACtest/Messages.json',
    )
  })

  it('rejects unsupported regions before sending credentials', async () => {
    vi.stubEnv('TWILIO_REGION', 'invalid')
    await expect(send()).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('reports the Twilio code and region without logging the response body or wrapping it twice', async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { code: 20003, message: 'Rejected test-secret for +46700000000' },
        { status: 401 },
      ),
    )
    const error = await Effect.runPromise(
      SMSService.use((sms) =>
        sms.send({ phoneNumber: '+46700000000', message: 'Voting invite' }),
      ).pipe(
        Effect.provide(TwilioSMSServiceLayer),
        Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ ...process.env }))),
        Effect.flip,
      ),
    )
    expect(error.message).toBe('Twilio rejected the message (HTTP 401, region ie1, code 20003)')
    expect(error.cause).toEqual({ httpStatus: 401, region: 'ie1', twilioCode: 20003 })
    expect(JSON.stringify(error)).not.toContain('test-secret')
    expect(JSON.stringify(error)).not.toContain('+46700000000')
  })

  it('preserves HTTP diagnostics when Twilio returns a non-JSON error', async () => {
    fetchMock.mockResolvedValue(new Response('upstream unavailable', { status: 502 }))
    await expect(send()).rejects.toThrow('Twilio rejected the message (HTTP 502, region ie1)')
  })
})
