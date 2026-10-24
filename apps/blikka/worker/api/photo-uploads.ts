import { handleCallback } from '@vercel/queue'

export const POST = handleCallback(async (message, metadata) => {
  console.log('worker received', metadata.messageId, message)
})
