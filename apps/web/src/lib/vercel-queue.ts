import { Redis } from '@upstash/redis'
import { handleCallback, type MessageMetadata } from '@vercel/queue'
import { isVercelByCamera } from '@blikka/aws/deployment'

/** Queues have no dead-letter queue. Retain exhausted jobs for manual inspection/replay. */
export function queueConsumer(run: (payload: unknown, metadata: MessageMetadata) => Promise<void>) {
  const consume = handleCallback(
    async (payload: unknown, metadata: MessageMetadata) => {
      try {
        await run(payload, metadata)
      } catch (error) {
        if (metadata.deliveryCount < 5) throw error
        const redis = Redis.fromEnv()
        await redis.set(
          `vercel:failed-jobs:${metadata.messageId}`,
          {
            payload,
            failedAt: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Queue processing failed',
          },
          { ex: 60 * 60 * 24 * 30 },
        )
        console.error('Queue job exhausted retries; saved for recovery', {
          messageId: metadata.messageId,
        })
        // Acknowledge only after the failure is durably stored.
      }
    },
    {
      visibilityTimeoutSeconds: 330,
      retry: (_error, metadata) => ({ afterSeconds: Math.min(30 * metadata.deliveryCount, 300) }),
    },
  )

  return (request: Request) => {
    if (!isVercelByCamera()) return new Response('Not found', { status: 404 })
    return consume(request)
  }
}
