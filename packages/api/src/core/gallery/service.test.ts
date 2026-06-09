import { assert, describe, it } from '@effect/vitest'
import {
  GalleryRepository,
  MarathonsRepository,
  type CompetitionClass,
  type GalleryPublication,
  type Marathon,
  type Topic,
} from '@blikka/db'
import { Effect, Layer, Option, Ref } from 'effect'

import { BadRequestError, NotFoundError, PreconditionFailedError } from '../errors'
import { makeTopic } from '../test/fixtures/topic'
import { GalleryService, GalleryServiceLayerNoDeps } from './service'

const domain = 'demo'

function makeClass(overrides: Partial<CompetitionClass> = {}): CompetitionClass {
  return {
    id: 1,
    marathonId: 1,
    name: 'Open',
    description: null,
    numberOfPhotos: 8,
    topicStartIndex: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as CompetitionClass
}

type MarathonWithOptions = Marathon & {
  topics: Topic[]
  competitionClasses: CompetitionClass[]
}

function makeMarathonWithOptions(
  overrides: Partial<MarathonWithOptions> = {},
): MarathonWithOptions {
  return {
    id: 1,
    domain,
    mode: 'marathon',
    setupCompleted: true,
    startDate: '2026-05-21T10:00:00.000Z',
    endDate: '2026-05-21T18:00:00.000Z',
    contactSheetFormat: 'classic',
    verificationMode: 'all',
    logoUrl: null,
    name: 'Demo Marathon',
    topics: [makeTopic({ id: 10, name: 'Topic A', orderIndex: 1 })],
    competitionClasses: [makeClass()],
    ...overrides,
  } as MarathonWithOptions
}

function makePublication(overrides: Partial<GalleryPublication> = {}): GalleryPublication {
  return {
    id: 1,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: null,
    marathonId: 1,
    topicId: null,
    publishedAt: null,
    featuredSections: [],
    ...overrides,
  } as GalleryPublication
}

interface GalleryRepoState {
  publications: GalleryPublication[]
  feedItems: Array<Record<string, unknown>>
  participantSet: Option.Option<{
    reference: string
    competitionClassId: number | null
    competitionClassName: string | null
    submissions: Array<Record<string, unknown>>
  }>
  topicWinners: Array<Record<string, unknown>>
  classWinners: Array<Record<string, unknown>>
  byCameraWinners: Array<Record<string, unknown>>
}

const makeGalleryRepoLayer = (
  stateRef: Ref.Ref<GalleryRepoState>,
  upsertsRef: Ref.Ref<GalleryPublication[]>,
) =>
  Layer.succeed(GalleryRepository)(
    GalleryRepository.of({
      getPublicationsForMarathon: () =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          return state.publications
        }),
      getPublication: ({ topicId }: { marathonId: number; topicId: number | null }) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          return Option.fromNullishOr(
            state.publications.find((publication) => publication.topicId === topicId) ?? null,
          )
        }),
      upsertPublication: (params: {
        topicId: number | null
        publishedAt: string | null
        featuredSections: GalleryPublication['featuredSections']
      }) =>
        Effect.gen(function* () {
          const publication = makePublication({
            topicId: params.topicId,
            publishedAt: params.publishedAt,
            featuredSections: params.featuredSections,
          })
          yield* Ref.update(upsertsRef, (current) => [...current, publication])
          return publication
        }),
      getFeedPage: () =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          return { items: state.feedItems as never, nextCursor: null }
        }),
      getParticipantSet: () =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          return state.participantSet as never
        }),
      getTopicWinners: () =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          return state.topicWinners as never
        }),
      getClassWinners: () =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          return state.classWinners as never
        }),
      getByCameraTopicWinners: () =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          return state.byCameraWinners as never
        }),
    } as unknown as GalleryRepository['Service']),
  )

const makeMarathonRepoLayer = (marathon: MarathonWithOptions | null) =>
  Layer.succeed(MarathonsRepository)(
    MarathonsRepository.of({
      getMarathonByDomainWithOptions: () => Effect.succeed(Option.fromNullishOr(marathon)),
    } as unknown as MarathonsRepository['Service']),
  )

const defaultState = (overrides: Partial<GalleryRepoState> = {}): GalleryRepoState => ({
  publications: [],
  feedItems: [],
  participantSet: Option.none(),
  topicWinners: [],
  classWinners: [],
  byCameraWinners: [],
  ...overrides,
})

const run = <A, E>(
  effect: Effect.Effect<A, E, GalleryService>,
  options: {
    marathon: MarathonWithOptions | null
    state?: GalleryRepoState
  },
) =>
  Effect.gen(function* () {
    const stateRef = yield* Ref.make(options.state ?? defaultState())
    const upsertsRef = yield* Ref.make<GalleryPublication[]>([])
    const result = yield* effect.pipe(
      Effect.provide(GalleryServiceLayerNoDeps),
      Effect.provide(makeGalleryRepoLayer(stateRef, upsertsRef)),
      Effect.provide(makeMarathonRepoLayer(options.marathon)),
    )
    return { result, upserts: yield* Ref.get(upsertsRef) }
  })

const PRIVATE_FORBIDDEN_KEYS = [
  'previewKey',
  'firstname',
  'lastname',
  'email',
  'phoneHash',
  'phoneEncrypted',
  'exif',
  'metadata',
]

function assertNoPrivateFields(record: Record<string, unknown>) {
  for (const forbidden of PRIVATE_FORBIDDEN_KEYS) {
    assert.isFalse(forbidden in record, `expected DTO not to expose '${forbidden}'`)
  }
}

describe('GalleryService.getPublicGallery', () => {
  it.effect('fails with NotFound when a marathon gallery is not published', () =>
    Effect.gen(function* () {
      const exit = yield* run(
        Effect.gen(function* () {
          const service = yield* GalleryService
          return yield* service.getPublicGallery({ domain })
        }),
        { marathon: makeMarathonWithOptions() },
      ).pipe(Effect.flip)

      assert.instanceOf(exit, NotFoundError)
    }),
  )

  it.effect('returns public-safe data and resolves enabled featured sections when published', () =>
    Effect.gen(function* () {
      const publication = makePublication({
        publishedAt: '2026-06-02T00:00:00.000Z',
        featuredSections: [
          { id: 's1', kind: 'topic-winners', enabled: true, order: 0, topicId: 10 },
          { id: 's2', kind: 'topic-winners', enabled: false, order: 1, topicId: 10 },
        ],
      })

      const { result } = yield* run(
        Effect.gen(function* () {
          const service = yield* GalleryService
          return yield* service.getPublicGallery({ domain })
        }),
        {
          marathon: makeMarathonWithOptions(),
          state: defaultState({
            publications: [publication],
            topicWinners: [
              {
                rank: 1,
                participantReference: '1024',
                submissionId: 5,
                thumbnailKey: 't.jpg',
                key: 'o.jpg',
                topicId: 10,
                topicName: 'Topic A',
              },
            ],
          }),
        },
      )

      assert.strictEqual(result.published, true)
      assert.strictEqual(result.featuredSections.length, 1)
      const section = result.featuredSections[0]!
      assert.strictEqual(section.photos.length, 1)
      const photo = section.photos[0]!
      assert.strictEqual(photo.participantReference, '1024')
      assert.strictEqual(photo.key, 'o.jpg')
      assertNoPrivateFields(photo as unknown as Record<string, unknown>)
    }),
  )

  it.effect('skips stale featured section configs whose topic no longer exists', () =>
    Effect.gen(function* () {
      const publication = makePublication({
        publishedAt: '2026-06-02T00:00:00.000Z',
        featuredSections: [
          { id: 'stale', kind: 'topic-winners', enabled: true, order: 0, topicId: 999 },
          { id: 'valid', kind: 'topic-winners', enabled: true, order: 1, topicId: 10 },
        ],
      })

      const { result } = yield* run(
        Effect.gen(function* () {
          const service = yield* GalleryService
          return yield* service.getPublicGallery({ domain })
        }),
        {
          marathon: makeMarathonWithOptions(),
          state: defaultState({
            publications: [publication],
            topicWinners: [
              {
                rank: 1,
                participantReference: '1024',
                submissionId: 5,
                thumbnailKey: 't.jpg',
                key: 'o.jpg',
                topicId: 10,
                topicName: 'Topic A',
              },
            ],
          }),
        },
      )

      assert.deepStrictEqual(
        result.featuredSections.map((section) => section.id),
        ['valid'],
      )
    }),
  )

  it.effect('shows only published topic cards for by-camera gallery home', () =>
    Effect.gen(function* () {
      const topicPublished = makeTopic({ id: 10, name: 'Topic A', orderIndex: 0 })
      const topicHidden = makeTopic({ id: 11, name: 'Topic B', orderIndex: 1 })

      const { result } = yield* run(
        Effect.gen(function* () {
          const service = yield* GalleryService
          return yield* service.getPublicGallery({ domain })
        }),
        {
          marathon: makeMarathonWithOptions({
            mode: 'by-camera',
            topics: [topicHidden, topicPublished],
          }),
          state: defaultState({
            publications: [
              makePublication({ id: 2, topicId: 10, publishedAt: '2026-06-02T00:00:00.000Z' }),
            ],
          }),
        },
      )

      assert.strictEqual(result.published, true)
      assert.deepStrictEqual(
        result.topics.map((topic) => topic.id),
        [10],
      )
    }),
  )
})

describe('GalleryService.getGalleryFeed', () => {
  it.effect('fails with NotFound for an unpublished marathon feed', () =>
    Effect.gen(function* () {
      const exit = yield* run(
        Effect.gen(function* () {
          const service = yield* GalleryService
          return yield* service.getGalleryFeed({ domain })
        }),
        { marathon: makeMarathonWithOptions() },
      ).pipe(Effect.flip)

      assert.instanceOf(exit, NotFoundError)
    }),
  )

  it.effect('returns PII-safe feed items when the marathon is published', () =>
    Effect.gen(function* () {
      const { result } = yield* run(
        Effect.gen(function* () {
          const service = yield* GalleryService
          return yield* service.getGalleryFeed({ domain })
        }),
        {
          marathon: makeMarathonWithOptions(),
          state: defaultState({
            publications: [makePublication({ publishedAt: '2026-06-02T00:00:00.000Z' })],
            feedItems: [
              {
                submissionId: 7,
                participantReference: '2048',
                thumbnailKey: 't.jpg',
                key: 'o.jpg',
                topicId: 10,
                topicName: 'Topic A',
                topicOrderIndex: 1,
                competitionClassId: 1,
                competitionClassName: 'Open',
              },
            ],
          }),
        },
      )

      assert.strictEqual(result.items.length, 1)
      const item = result.items[0]!
      assert.strictEqual(item.participantReference, '2048')
      assert.strictEqual(item.key, 'o.jpg')
      assertNoPrivateFields(item as unknown as Record<string, unknown>)
    }),
  )

  it.effect('requires a topicOrderIndex for by-camera feeds', () =>
    Effect.gen(function* () {
      const exit = yield* run(
        Effect.gen(function* () {
          const service = yield* GalleryService
          return yield* service.getGalleryFeed({ domain })
        }),
        { marathon: makeMarathonWithOptions({ mode: 'by-camera' }) },
      ).pipe(Effect.flip)

      assert.instanceOf(exit, BadRequestError)
    }),
  )

  it.effect('rejects an unknown marathon topic filter instead of returning all photos', () =>
    Effect.gen(function* () {
      const exit = yield* run(
        Effect.gen(function* () {
          const service = yield* GalleryService
          return yield* service.getGalleryFeed({ domain, topicOrderIndex: 999 })
        }),
        {
          marathon: makeMarathonWithOptions(),
          state: defaultState({
            publications: [makePublication({ publishedAt: '2026-06-02T00:00:00.000Z' })],
          }),
        },
      ).pipe(Effect.flip)

      assert.instanceOf(exit, BadRequestError)
    }),
  )

  it.effect('rejects malformed feed cursors', () =>
    Effect.gen(function* () {
      const exit = yield* run(
        Effect.gen(function* () {
          const service = yield* GalleryService
          return yield* service.getGalleryFeed({ domain, cursor: 'not-a-cursor' })
        }),
        {
          marathon: makeMarathonWithOptions(),
          state: defaultState({
            publications: [makePublication({ publishedAt: '2026-06-02T00:00:00.000Z' })],
          }),
        },
      ).pipe(Effect.flip)

      assert.instanceOf(exit, BadRequestError)
    }),
  )
})

describe('GalleryService.getByCameraTopicGallery', () => {
  it.effect('returns the selected published topic and published topic navigation', () =>
    Effect.gen(function* () {
      const topicPublished = makeTopic({ id: 10, name: 'Topic A', orderIndex: 0 })
      const topicAlsoPublished = makeTopic({ id: 11, name: 'Topic B', orderIndex: 1 })
      const topicHidden = makeTopic({ id: 12, name: 'Topic C', orderIndex: 2 })

      const { result } = yield* run(
        Effect.gen(function* () {
          const service = yield* GalleryService
          return yield* service.getByCameraTopicGallery({ domain, topicOrderIndex: 0 })
        }),
        {
          marathon: makeMarathonWithOptions({
            mode: 'by-camera',
            topics: [topicHidden, topicAlsoPublished, topicPublished],
          }),
          state: defaultState({
            publications: [
              makePublication({ id: 2, topicId: 10, publishedAt: '2026-06-02T00:00:00.000Z' }),
              makePublication({ id: 3, topicId: 11, publishedAt: '2026-06-02T00:00:00.000Z' }),
            ],
          }),
        },
      )

      assert.strictEqual(result.topic.id, 10)
      assert.deepStrictEqual(
        result.publishedTopics.map((topic) => topic.id),
        [10, 11],
      )
    }),
  )
})

describe('GalleryService.getGalleryParticipantSet', () => {
  it.effect('hides submissions for unpublished topics in by-camera mode', () =>
    Effect.gen(function* () {
      const topicPublished = makeTopic({ id: 10, name: 'Topic A', orderIndex: 1 })
      const topicHidden = makeTopic({ id: 11, name: 'Topic B', orderIndex: 2 })

      const { result } = yield* run(
        Effect.gen(function* () {
          const service = yield* GalleryService
          return yield* service.getGalleryParticipantSet({ domain, reference: '4096' })
        }),
        {
          marathon: makeMarathonWithOptions({
            mode: 'by-camera',
            topics: [topicPublished, topicHidden],
          }),
          state: defaultState({
            publications: [
              makePublication({ id: 2, topicId: 10, publishedAt: '2026-06-02T00:00:00.000Z' }),
            ],
            participantSet: Option.some({
              reference: '4096',
              competitionClassId: null,
              competitionClassName: null,
              submissions: [
                {
                  submissionId: 1,
                  submissionCreatedAt: '2026-06-01T00:00:00.000Z',
                  thumbnailKey: 't1.jpg',
                  key: 'o1.jpg',
                  topicId: 10,
                  topicName: 'Topic A',
                  topicOrderIndex: 1,
                },
                {
                  submissionId: 2,
                  submissionCreatedAt: '2026-06-01T00:00:00.000Z',
                  thumbnailKey: 't2.jpg',
                  key: 'o2.jpg',
                  topicId: 11,
                  topicName: 'Topic B',
                  topicOrderIndex: 2,
                },
              ],
            }),
          }),
        },
      )

      assert.strictEqual(result.submissions.length, 1)
      assert.strictEqual(result.submissions[0]!.topicId, 10)
    }),
  )
})

describe('GalleryService publication controls', () => {
  it.effect('rejects marathon-wide publication for by-camera mode', () =>
    Effect.gen(function* () {
      const exit = yield* run(
        Effect.gen(function* () {
          const service = yield* GalleryService
          return yield* service.setMarathonPublication({ domain, published: true })
        }),
        { marathon: makeMarathonWithOptions({ mode: 'by-camera' }) },
      ).pipe(Effect.flip)

      assert.instanceOf(exit, BadRequestError)
    }),
  )

  it.effect('blocks publishing a by-camera topic before its window closes', () =>
    Effect.gen(function* () {
      const openTopic = makeTopic({
        id: 10,
        name: 'Topic A',
        orderIndex: 1,
        scheduledEnd: '2999-01-01T00:00:00.000Z',
      })

      const exit = yield* run(
        Effect.gen(function* () {
          const service = yield* GalleryService
          return yield* service.setTopicPublication({ domain, topicId: 10, published: true })
        }),
        {
          marathon: makeMarathonWithOptions({ mode: 'by-camera', topics: [openTopic] }),
        },
      ).pipe(Effect.flip)

      assert.instanceOf(exit, PreconditionFailedError)
    }),
  )

  it.effect('publishes a by-camera topic after its window closes', () =>
    Effect.gen(function* () {
      const closedTopic = makeTopic({
        id: 10,
        name: 'Topic A',
        orderIndex: 1,
        scheduledEnd: '2020-01-01T00:00:00.000Z',
      })

      const { result, upserts } = yield* run(
        Effect.gen(function* () {
          const service = yield* GalleryService
          return yield* service.setTopicPublication({ domain, topicId: 10, published: true })
        }),
        {
          marathon: makeMarathonWithOptions({ mode: 'by-camera', topics: [closedTopic] }),
        },
      )

      assert.strictEqual(result.published, true)
      assert.strictEqual(upserts.length, 1)
      assert.strictEqual(upserts[0]!.topicId, 10)
      assert.isNotNull(upserts[0]!.publishedAt)
    }),
  )
})
