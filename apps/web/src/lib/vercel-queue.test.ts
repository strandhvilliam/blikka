import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const { set, captured } = vi.hoisted(() => ({
  set: vi.fn(),
  captured: {
    handler: undefined as
      | undefined
      | ((
          payload: unknown,
          metadata: { deliveryCount: number; messageId: string },
        ) => Promise<void>),
  },
}))
vi.mock('@upstash/redis', () => ({ Redis: { fromEnv: () => ({ set }) } }))
vi.mock('@vercel/queue', () => ({
  handleCallback: (handler: typeof captured.handler) => {
    captured.handler = handler
    return vi.fn()
  },
}))
import { queueConsumer } from './vercel-queue'
beforeEach(() => {
  set.mockReset().mockResolvedValue('OK')
  vi.stubEnv('DEPLOYMENT_PROFILE', 'vercel-by-camera')
})
afterEach(() => vi.unstubAllEnvs())
describe('queue recovery', () => {
  it('rethrows transient failures for retry', async () => {
    queueConsumer(async () => {
      throw new Error('transient')
    })
    await expect(captured.handler!({}, { deliveryCount: 1, messageId: 'job' })).rejects.toThrow(
      'transient',
    )
    expect(set).not.toHaveBeenCalled()
  })
  it('saves an exhausted job before acknowledging', async () => {
    queueConsumer(async () => {
      throw new Error('persistent')
    })
    await captured.handler!({ submissionKeys: ['key'] }, { deliveryCount: 5, messageId: 'job' })
    expect(set).toHaveBeenCalledWith(
      'vercel:failed-jobs:job',
      expect.objectContaining({ payload: { submissionKeys: ['key'] }, error: 'persistent' }),
      { ex: 2592000 },
    )
  })
  it('does not acknowledge when failure persistence is unavailable', async () => {
    set.mockRejectedValue(new Error('redis unavailable'))
    queueConsumer(async () => {
      throw new Error('persistent')
    })
    await expect(captured.handler!({}, { deliveryCount: 5, messageId: 'job' })).rejects.toThrow(
      'redis unavailable',
    )
  })
})
