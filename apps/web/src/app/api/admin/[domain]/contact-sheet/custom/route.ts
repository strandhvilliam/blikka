import { NextRequest, NextResponse } from 'next/server'
import { Config, Effect, Option } from 'effect'
import {
  appRouter,
  createCallerFactory,
  createTRPCContext,
} from '@blikka/api/trpc'
import {
  ContactSheetBuilder,
  InvalidSheetParamsError,
  ContactSheetBuildError,
} from '@blikka/image-manipulation'
import { S3Service } from '@blikka/aws'
import { serverRuntime, type RuntimeDependencies } from '@/lib/server-runtime'
import { resolveContactSheetsSponsor } from '@/lib/sponsors/contact-sheets-sponsor'
import { sanitizeFilenameSegment } from '@/app/(marathon)/admin/[domain]/dashboard/export/_lib/sanitize-filename-segment'
import { parseCustomContactSheetConfig } from './_lib/contracts'

export const runtime = 'nodejs'

const createCaller = createCallerFactory(appRouter)

function jsonError(message: string, status: number, details?: string) {
  return NextResponse.json({ error: message, details: details ?? message }, { status })
}

function getDateStamp() {
  return new Date().toISOString().split('T')[0]
}

function customContactSheetPostEffect(
  request: NextRequest,
  domain: string,
): Effect.Effect<NextResponse, never, RuntimeDependencies> {
  return Effect.gen(function* () {
    const formData = yield* Effect.promise(() => request.formData())
    const configRaw = formData.get('config')

    if (typeof configRaw !== 'string') {
      return jsonError('Missing config', 400)
    }

    const parsedConfig = parseCustomContactSheetConfig(configRaw)
    if (!parsedConfig.ok) {
      return jsonError('Invalid config', 400, parsedConfig.message)
    }

    const config = parsedConfig.config

    const headers = new Headers(request.headers)
    headers.set('x-marathon-domain', domain)

    const ctx = yield* Effect.promise(() =>
      createTRPCContext({
        runtime: serverRuntime,
        headers,
      }),
    )

    const caller = createCaller(ctx)

    const marathon = yield* Effect.promise(() => caller.marathons.getByDomain({ domain }))
    if (!marathon) {
      return jsonError('Marathon not found', 404)
    }

    if (marathon.mode !== 'marathon') {
      return jsonError('Contact sheet builder is only available for marathon mode', 400)
    }

    const images: Array<{ orderIndex: number; buffer: Buffer }> = []

    for (let orderIndex = 0; orderIndex < config.photoCount; orderIndex++) {
      const entry = formData.get(`image-${orderIndex}`)
      if (!(entry instanceof File)) {
        return jsonError('Invalid images', 400, `Missing image for slot ${orderIndex + 1}`)
      }

      const buffer = Buffer.from(yield* Effect.promise(() => entry.arrayBuffer()))
      images.push({ orderIndex, buffer })
    }

    const topicByIndex = new Map(config.topics.map((topic) => [topic.orderIndex, topic.name]))
    for (let orderIndex = 0; orderIndex < config.photoCount; orderIndex++) {
      const label = topicByIndex.get(orderIndex)
      if (!label?.trim()) {
        return jsonError('Invalid topics', 400, `Missing label for photo ${orderIndex + 1}`)
      }
    }

    let sponsorImage: Buffer | undefined

    if (config.includeSponsor) {
      const sponsors = yield* Effect.promise(() => caller.sponsors.getByMarathon({ domain }))
      const sponsor = resolveContactSheetsSponsor(sponsors)

      if (!sponsor) {
        return jsonError(
          'Sponsor missing',
          400,
          'Upload a contact-sheets sponsor first or disable the sponsor slot',
        )
      }

      const sponsorsBucketName = yield* Config.string('MARATHON_SETTINGS_BUCKET_NAME')
      const sponsorFile = yield* S3Service.use((s3) => s3.getFile(sponsorsBucketName, sponsor.key))

      if (Option.isNone(sponsorFile)) {
        return jsonError('Sponsor image not found', 400, `Missing sponsor object: ${sponsor.key}`)
      }

      sponsorImage = Buffer.from(sponsorFile.value)
    }

    const buffer = yield* ContactSheetBuilder.use((builder) =>
      builder.createSheet({
        reference: config.reference,
        images,
        sponsorImage,
        sponsorPosition: config.sponsorPosition,
        topics: config.topics,
        format: config.format,
      }),
    ).pipe(
      Effect.catchTags({
        InvalidSheetParamsError: (error: InvalidSheetParamsError) =>
          Effect.fail(error),
        ContactSheetBuildError: (error: ContactSheetBuildError) =>
          Effect.fail(error),
      }),
    )

    const referenceSegment = sanitizeFilenameSegment(config.reference) || 'custom'

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Disposition': `attachment; filename="contact-sheet-${referenceSegment}-${getDateStamp()}.jpg"`,
      },
    })
  }).pipe(
    Effect.catchCause((cause) => {
      const error = cause
      if (error instanceof InvalidSheetParamsError) {
        return Effect.succeed(jsonError('Invalid sheet parameters', 400, error.message))
      }
      if (error instanceof ContactSheetBuildError) {
        return Effect.succeed(jsonError('Failed to build contact sheet', 500, error.message))
      }
      if (error instanceof Error) {
        return Effect.succeed(jsonError('Failed to generate contact sheet', 500, error.message))
      }
      return Effect.succeed(jsonError('Failed to generate contact sheet', 500, 'Unknown error'))
    }),
  )
}

export async function POST(
  request: NextRequest,
  routeContext: { params: Promise<{ domain: string }> },
) {
  const { domain } = await routeContext.params

  try {
    return await serverRuntime.runPromise(customContactSheetPostEffect(request, domain))
  } catch (error) {
    console.error(error)
    return jsonError(
      'Failed to generate contact sheet',
      500,
      error instanceof Error ? error.message : 'Unknown error',
    )
  }
}
