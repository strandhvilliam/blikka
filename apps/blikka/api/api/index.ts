import { send } from '@vercel/queue'

export default {
  async fetch(request: Request) {
    // Echoed so the response shows whether the service rewrite keeps the original /api/... path.
    const { pathname } = new URL(request.url)
    const { messageId } = await send('photo-uploads', { pathname, sentAt: new Date().toISOString() })
    return Response.json({ pathname, messageId, node: process.version })
  },
}
