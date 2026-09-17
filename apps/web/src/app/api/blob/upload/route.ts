import { handleUpload } from '@vercel/blob/client'
import { send } from '@vercel/queue'
import { Schema } from 'effect'
import { isVercelByCamera } from '@blikka/aws/deployment'

export const runtime = 'nodejs'

const CompletionBody = Schema.Struct({
  type: Schema.Literal('blob.upload-completed'),
  payload: Schema.Struct({
    blob: Schema.Struct({
      url: Schema.String,
      downloadUrl: Schema.String,
      pathname: Schema.String,
      contentType: Schema.String,
      contentDisposition: Schema.String,
      etag: Schema.String,
    }),
    tokenPayload: Schema.NullOr(Schema.String),
  }),
})
const UploadIdentity = Schema.Struct({ bucket: Schema.String, key: Schema.String })

export async function POST(request: Request) {
  if (!isVercelByCamera()) return new Response('Not found', { status: 404 })
  let body: typeof CompletionBody.Type
  try {
    const raw: unknown = await request.json()
    // Keep the exact parsed object: SDK signature verification includes property order.
    if (!Schema.is(CompletionBody)(raw))
      return new Response('Invalid completion event', { status: 400 })
    body = raw
  } catch {
    return new Response('Invalid completion event', { status: 400 })
  }
  // handleUpload verifies the Blob signature before invoking onUploadCompleted.
  // Failures (including queue outages) return 500 so Blob retries delivery.
  const result = await handleUpload({
    request,
    body,
    onBeforeGenerateToken: async () => {
      throw new Error('Use the authorized upload initializer')
    },
    onUploadCompleted: async ({ blob, tokenPayload }) => {
      const identity = Schema.decodeUnknownSync(UploadIdentity)(JSON.parse(tokenPayload ?? 'null'))
      if (
        identity.bucket !== process.env.SUBMISSIONS_BUCKET_NAME ||
        blob.pathname !== `${identity.bucket}/${identity.key}`
      ) {
        throw new Error('Unexpected Blob upload identity')
      }
      await send(
        'by-camera-uploads',
        { submissionKeys: [identity.key] },
        { idempotencyKey: `blob:${blob.pathname}:${blob.etag}` },
      )
    },
  })
  return Response.json(result)
}
