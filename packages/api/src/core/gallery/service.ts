import { Context, Effect, Layer, Option } from 'effect'
import {
  DbLayer,
  DbError,
  GalleryRepository,
  MarathonsRepository,
  type CompetitionClass,
  type GalleryFeaturedSection,
  type GalleryParticipantSubmission,
  type Marathon,
  type Topic,
} from '@blikka/db'
import { BadRequestError, NotFoundError, PreconditionFailedError, failNotFoundIfNone } from '../errors'
import type {
  GetByCameraTopicGallery,
  GetGalleryAdminState,
  GetGalleryFeed,
  GetGalleryParticipantSet,
  GetPublicGallery,
  SetMarathonPublication,
  SetTopicPublication,
  UpdateFeaturedSections,
} from './contracts'
import {
  finalizedStatusesForVerificationMode,
  isByCameraTopicPublishable,
  orderedEnabledFeaturedSections,
} from './helpers'

const DEFAULT_FEED_LIMIT = 60
const MAX_FEED_LIMIT = 120

/** Public-safe marathon metadata shown in the gallery header. */
export interface GalleryMarathonMeta {
  domain: string
  name: string
  logoUrl: string | null
  mode: string
}

export interface GalleryTopicMeta {
  id: number
  name: string
  orderIndex: number
  published: boolean
}

export interface GalleryClassMeta {
  id: number
  name: string
}

/** A single public, PII-safe photo card (winner or feed item). Never exposes the original key. */
export interface GalleryPhotoCard {
  submissionId: number
  participantReference: string
  thumbnailKey: string | null
  previewKey: string | null
  topicId: number
  topicName: string
  topicOrderIndex: number
  competitionClassId: number | null
  competitionClassName: string | null
  rank: number | null
}

export interface GalleryParticipantSetCard {
  rank: number
  participantReference: string
  competitionClassId: number
  competitionClassName: string
  submissions: GalleryPublicSubmission[]
}

export interface GalleryPublicSubmission {
  submissionId: number
  thumbnailKey: string | null
  previewKey: string | null
  topicId: number
  topicName: string
  topicOrderIndex: number
}

export interface ResolvedFeaturedSection {
  id: string
  kind: GalleryFeaturedSection['kind']
  title: string
  order: number
  photos: GalleryPhotoCard[]
  participantSets: GalleryParticipantSetCard[]
}

export interface PublicGallery {
  marathon: GalleryMarathonMeta
  published: boolean
  topics: GalleryTopicMeta[]
  competitionClasses: GalleryClassMeta[]
  featuredSections: ResolvedFeaturedSection[]
}

export interface GalleryFeedResult {
  items: GalleryPhotoCard[]
  nextCursor: string | null
}

export interface ByCameraTopicGallery {
  marathon: GalleryMarathonMeta
  topic: GalleryTopicMeta
  publishedTopics: GalleryTopicMeta[]
  featuredSections: ResolvedFeaturedSection[]
}

export interface GalleryParticipantSetResult {
  reference: string
  competitionClassId: number | null
  competitionClassName: string | null
  submissions: GalleryPublicSubmission[]
}

export interface AvailableFeaturedSection {
  kind: GalleryFeaturedSection['kind']
  title: string
  topicId?: number
  competitionClassId?: number
}

export interface AdminGalleryTopic {
  id: number
  name: string
  orderIndex: number
  scheduledEnd: string | null
  publishable: boolean
  published: boolean
  publishedAt: string | null
  featuredSections: GalleryFeaturedSection[]
}

export interface GalleryAdminState {
  marathon: GalleryMarathonMeta
  mode: string
  marathonPublished: boolean
  marathonPublishedAt: string | null
  marathonFeaturedSections: GalleryFeaturedSection[]
  topics: AdminGalleryTopic[]
  competitionClasses: GalleryClassMeta[]
  availableFeaturedSections: AvailableFeaturedSection[]
}

type MarathonWithOptions = Marathon & {
  topics: Topic[]
  competitionClasses: CompetitionClass[]
}

export class GalleryService extends Context.Service<
  GalleryService,
  {
    readonly getPublicGallery: (
      input: GetPublicGallery,
    ) => Effect.Effect<PublicGallery, DbError | NotFoundError, never>
    readonly getGalleryFeed: (
      input: GetGalleryFeed,
    ) => Effect.Effect<GalleryFeedResult, DbError | NotFoundError | BadRequestError, never>
    readonly getByCameraTopicGallery: (
      input: GetByCameraTopicGallery,
    ) => Effect.Effect<ByCameraTopicGallery, DbError | NotFoundError | BadRequestError, never>
    readonly getGalleryParticipantSet: (
      input: GetGalleryParticipantSet,
    ) => Effect.Effect<GalleryParticipantSetResult, DbError | NotFoundError, never>
    readonly getGalleryAdminState: (
      input: GetGalleryAdminState,
    ) => Effect.Effect<GalleryAdminState, DbError | NotFoundError, never>
    readonly setMarathonPublication: (
      input: SetMarathonPublication,
    ) => Effect.Effect<{ published: boolean }, DbError | NotFoundError | BadRequestError, never>
    readonly setTopicPublication: (
      input: SetTopicPublication,
    ) => Effect.Effect<
      { published: boolean },
      DbError | NotFoundError | BadRequestError | PreconditionFailedError,
      never
    >
    readonly updateFeaturedSections: (
      input: UpdateFeaturedSections,
    ) => Effect.Effect<{ updated: boolean }, DbError | NotFoundError, never>
  }
>()('@blikka/api/GalleryService') {}

const makeGalleryService = Effect.gen(function* () {
  const marathonsRepository = yield* MarathonsRepository
  const galleryRepository = yield* GalleryRepository

  const toMarathonMeta = (marathon: Marathon): GalleryMarathonMeta => ({
    domain: marathon.domain,
    name: marathon.name,
    logoUrl: marathon.logoUrl,
    mode: marathon.mode,
  })

  const resolveMarathon = (domain: string) =>
    marathonsRepository
      .getMarathonByDomainWithOptions({ domain })
      .pipe(failNotFoundIfNone('Marathon', { domain }))

  const toPublicSubmission = (
    submission: GalleryParticipantSubmission,
  ): GalleryPublicSubmission => ({
    submissionId: submission.submissionId,
    thumbnailKey: submission.thumbnailKey,
    previewKey: submission.previewKey,
    topicId: submission.topicId,
    topicName: submission.topicName,
    topicOrderIndex: submission.topicOrderIndex,
  })

  const resolveFeaturedSections = Effect.fn('GalleryService.resolveFeaturedSections')(function* ({
    marathon,
    sections,
  }: {
    marathon: MarathonWithOptions
    sections: readonly GalleryFeaturedSection[]
  }) {
    const topicsById = new Map(marathon.topics.map((topic) => [topic.id, topic]))
    const classesById = new Map(
      marathon.competitionClasses.map((competitionClass) => [competitionClass.id, competitionClass]),
    )

    const enabled = orderedEnabledFeaturedSections(sections)
    const resolved: ResolvedFeaturedSection[] = []

    for (const section of enabled) {
      if (section.kind === 'topic-winners' && section.topicId !== undefined) {
        const topic = topicsById.get(section.topicId)
        const winners = yield* galleryRepository.getTopicWinners({
          marathonId: marathon.id,
          topicId: section.topicId,
        })
        const photos: GalleryPhotoCard[] = winners.map((winner) => ({
          submissionId: winner.submissionId,
          participantReference: winner.participantReference,
          thumbnailKey: winner.thumbnailKey,
          previewKey: winner.previewKey,
          topicId: winner.topicId,
          topicName: winner.topicName,
          topicOrderIndex: topic?.orderIndex ?? 0,
          competitionClassId: null,
          competitionClassName: null,
          rank: winner.rank,
        }))
        if (photos.length > 0) {
          resolved.push({
            id: section.id,
            kind: section.kind,
            title: `${topic?.name ?? 'Topic'} winners`,
            order: section.order,
            photos,
            participantSets: [],
          })
        }
      } else if (section.kind === 'by-camera-topic-winners' && section.topicId !== undefined) {
        const topic = topicsById.get(section.topicId)
        const winners = yield* galleryRepository.getByCameraTopicWinners({
          marathonId: marathon.id,
          topicId: section.topicId,
        })
        const photos: GalleryPhotoCard[] = winners.map((winner) => ({
          submissionId: winner.submissionId,
          participantReference: winner.participantReference,
          thumbnailKey: winner.thumbnailKey,
          previewKey: winner.previewKey,
          topicId: winner.topicId,
          topicName: winner.topicName,
          topicOrderIndex: topic?.orderIndex ?? 0,
          competitionClassId: null,
          competitionClassName: null,
          rank: winner.rank,
        }))
        if (photos.length > 0) {
          resolved.push({
            id: section.id,
            kind: section.kind,
            title: `${topic?.name ?? 'Topic'} winners`,
            order: section.order,
            photos,
            participantSets: [],
          })
        }
      } else if (section.kind === 'class-winners' && section.competitionClassId !== undefined) {
        const competitionClass = classesById.get(section.competitionClassId)
        const winners = yield* galleryRepository.getClassWinners({
          marathonId: marathon.id,
          competitionClassId: section.competitionClassId,
        })
        const participantSets: GalleryParticipantSetCard[] = winners.map((winner) => ({
          rank: winner.rank,
          participantReference: winner.participantReference,
          competitionClassId: winner.competitionClassId,
          competitionClassName: winner.competitionClassName,
          submissions: winner.submissions.map(toPublicSubmission),
        }))
        if (participantSets.length > 0) {
          resolved.push({
            id: section.id,
            kind: section.kind,
            title: `${competitionClass?.name ?? 'Class'} winners`,
            order: section.order,
            photos: [],
            participantSets,
          })
        }
      }
    }

    return resolved
  })

  const getPublicGallery: GalleryService['Service']['getPublicGallery'] = Effect.fn(
    'GalleryService.getPublicGallery',
  )(function* ({ domain }) {
    const marathon = yield* resolveMarathon(domain)
    const publications = yield* galleryRepository.getPublicationsForMarathon({
      marathonId: marathon.id,
    })

    const marathonPublication = publications.find((publication) => publication.topicId === null)
    const publishedTopicIds = new Set(
      publications
        .filter((publication) => publication.topicId !== null && publication.publishedAt !== null)
        .map((publication) => publication.topicId as number),
    )

    const isByCamera = marathon.mode === 'by-camera'
    const marathonPublished = !isByCamera && marathonPublication?.publishedAt != null

    if (!isByCamera && !marathonPublished) {
      return yield* Effect.fail(new NotFoundError({ resource: 'Gallery', identifier: { domain } }))
    }

    const topics: GalleryTopicMeta[] = marathon.topics
      .toSorted((a, b) => a.orderIndex - b.orderIndex)
      .map((topic) => ({
        id: topic.id,
        name: topic.name,
        orderIndex: topic.orderIndex,
        published: isByCamera ? publishedTopicIds.has(topic.id) : true,
      }))

    const competitionClasses: GalleryClassMeta[] = marathon.competitionClasses.map(
      (competitionClass) => ({ id: competitionClass.id, name: competitionClass.name }),
    )

    const featuredSections = isByCamera
      ? []
      : yield* resolveFeaturedSections({
          marathon,
          sections: marathonPublication?.featuredSections ?? [],
        })

    return {
      marathon: toMarathonMeta(marathon),
      published: isByCamera ? publishedTopicIds.size > 0 : true,
      topics: isByCamera ? topics.filter((topic) => topic.published) : topics,
      competitionClasses,
      featuredSections,
    }
  })

  const resolveTopicByOrderIndex = (marathon: MarathonWithOptions, orderIndex: number) =>
    marathon.topics.find((topic) => topic.orderIndex === orderIndex) ?? null

  const getGalleryFeed: GalleryService['Service']['getGalleryFeed'] = Effect.fn(
    'GalleryService.getGalleryFeed',
  )(function* ({ domain, topicOrderIndex, competitionClassId, cursor, limit }) {
    const marathon = yield* resolveMarathon(domain)
    const finalizedStatuses = finalizedStatusesForVerificationMode(marathon.verificationMode)
    const safeLimit = Math.min(Math.max(limit ?? DEFAULT_FEED_LIMIT, 1), MAX_FEED_LIMIT)
    const isByCamera = marathon.mode === 'by-camera'

    let topicId: number | null = null

    if (isByCamera) {
      if (topicOrderIndex === undefined || topicOrderIndex === null) {
        return yield* Effect.fail(
          new BadRequestError({ message: 'topicOrderIndex is required for by-camera galleries' }),
        )
      }
      const topic = resolveTopicByOrderIndex(marathon, topicOrderIndex)
      if (!topic) {
        return yield* Effect.fail(
          new NotFoundError({ resource: 'Topic', identifier: { domain, topicOrderIndex } }),
        )
      }
      const publication = yield* galleryRepository.getPublication({
        marathonId: marathon.id,
        topicId: topic.id,
      })
      if (Option.isNone(publication) || publication.value.publishedAt === null) {
        return yield* Effect.fail(
          new NotFoundError({ resource: 'Gallery', identifier: { domain, topicOrderIndex } }),
        )
      }
      topicId = topic.id
    } else {
      const marathonPublication = yield* galleryRepository.getPublication({
        marathonId: marathon.id,
        topicId: null,
      })
      if (Option.isNone(marathonPublication) || marathonPublication.value.publishedAt === null) {
        return yield* Effect.fail(
          new NotFoundError({ resource: 'Gallery', identifier: { domain } }),
        )
      }
      if (topicOrderIndex !== undefined && topicOrderIndex !== null) {
        const topic = resolveTopicByOrderIndex(marathon, topicOrderIndex)
        topicId = topic?.id ?? null
      }
    }

    const page = yield* galleryRepository.getFeedPage({
      marathonId: marathon.id,
      finalizedStatuses,
      topicId,
      competitionClassId: competitionClassId ?? null,
      cursor,
      limit: safeLimit,
    })

    const items: GalleryPhotoCard[] = page.items.map((item) => ({
      submissionId: item.submissionId,
      participantReference: item.participantReference,
      thumbnailKey: item.thumbnailKey,
      previewKey: item.previewKey,
      topicId: item.topicId,
      topicName: item.topicName,
      topicOrderIndex: item.topicOrderIndex,
      competitionClassId: item.competitionClassId,
      competitionClassName: item.competitionClassName,
      rank: null,
    }))

    return { items, nextCursor: page.nextCursor }
  })

  const getByCameraTopicGallery: GalleryService['Service']['getByCameraTopicGallery'] = Effect.fn(
    'GalleryService.getByCameraTopicGallery',
  )(function* ({ domain, topicOrderIndex }) {
    const marathon = yield* resolveMarathon(domain)

    if (marathon.mode !== 'by-camera') {
      return yield* Effect.fail(
        new BadRequestError({ message: `Marathon '${domain}' is not in by-camera mode` }),
      )
    }

    const topic = resolveTopicByOrderIndex(marathon, topicOrderIndex)
    if (!topic) {
      return yield* Effect.fail(
        new NotFoundError({ resource: 'Topic', identifier: { domain, topicOrderIndex } }),
      )
    }

    const publications = yield* galleryRepository.getPublicationsForMarathon({
      marathonId: marathon.id,
    })
    const topicPublication = publications.find((publication) => publication.topicId === topic.id)

    if (!topicPublication || topicPublication.publishedAt === null) {
      return yield* Effect.fail(
        new NotFoundError({ resource: 'Gallery', identifier: { domain, topicOrderIndex } }),
      )
    }

    const publishedTopicIds = new Set(
      publications
        .filter((publication) => publication.topicId !== null && publication.publishedAt !== null)
        .map((publication) => publication.topicId as number),
    )

    const publishedTopics: GalleryTopicMeta[] = marathon.topics
      .filter((candidate) => publishedTopicIds.has(candidate.id))
      .toSorted((a, b) => a.orderIndex - b.orderIndex)
      .map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        orderIndex: candidate.orderIndex,
        published: true,
      }))

    const featuredSections = yield* resolveFeaturedSections({
      marathon,
      sections: topicPublication.featuredSections,
    })

    return {
      marathon: toMarathonMeta(marathon),
      topic: { id: topic.id, name: topic.name, orderIndex: topic.orderIndex, published: true },
      publishedTopics,
      featuredSections,
    }
  })

  const getGalleryParticipantSet: GalleryService['Service']['getGalleryParticipantSet'] =
    Effect.fn('GalleryService.getGalleryParticipantSet')(function* ({ domain, reference }) {
      const marathon = yield* resolveMarathon(domain)
      const finalizedStatuses = finalizedStatusesForVerificationMode(marathon.verificationMode)
      const isByCamera = marathon.mode === 'by-camera'

      const publications = yield* galleryRepository.getPublicationsForMarathon({
        marathonId: marathon.id,
      })

      const marathonPublished =
        publications.find((publication) => publication.topicId === null)?.publishedAt != null
      const publishedTopicIds = new Set(
        publications
          .filter((publication) => publication.topicId !== null && publication.publishedAt !== null)
          .map((publication) => publication.topicId as number),
      )

      const galleryVisible = isByCamera ? publishedTopicIds.size > 0 : marathonPublished
      if (!galleryVisible) {
        return yield* Effect.fail(
          new NotFoundError({ resource: 'Gallery', identifier: { domain } }),
        )
      }

      const participantSet = yield* galleryRepository
        .getParticipantSet({ marathonId: marathon.id, reference, finalizedStatuses })
        .pipe(failNotFoundIfNone('Participant', { domain, reference }))

      const submissions = isByCamera
        ? participantSet.submissions.filter((submission) =>
            publishedTopicIds.has(submission.topicId),
          )
        : participantSet.submissions

      if (submissions.length === 0) {
        return yield* Effect.fail(
          new NotFoundError({ resource: 'Participant', identifier: { domain, reference } }),
        )
      }

      return {
        reference: participantSet.reference,
        competitionClassId: participantSet.competitionClassId,
        competitionClassName: participantSet.competitionClassName,
        submissions: submissions.map(toPublicSubmission),
      }
    })

  const buildAvailableFeaturedSections = (
    marathon: MarathonWithOptions,
  ): AvailableFeaturedSection[] => {
    const sortedTopics = marathon.topics.toSorted((a, b) => a.orderIndex - b.orderIndex)
    const isByCamera = marathon.mode === 'by-camera'

    if (isByCamera) {
      return sortedTopics.map((topic) => ({
        kind: 'by-camera-topic-winners' as const,
        title: `${topic.name} winners`,
        topicId: topic.id,
      }))
    }

    const topicSections: AvailableFeaturedSection[] = sortedTopics.map((topic) => ({
      kind: 'topic-winners' as const,
      title: `${topic.name} winners`,
      topicId: topic.id,
    }))
    const classSections: AvailableFeaturedSection[] = marathon.competitionClasses.map(
      (competitionClass) => ({
        kind: 'class-winners' as const,
        title: `${competitionClass.name} winners`,
        competitionClassId: competitionClass.id,
      }),
    )
    return [...topicSections, ...classSections]
  }

  const getGalleryAdminState: GalleryService['Service']['getGalleryAdminState'] = Effect.fn(
    'GalleryService.getGalleryAdminState',
  )(function* ({ domain }) {
    const marathon = yield* resolveMarathon(domain)
    const publications = yield* galleryRepository.getPublicationsForMarathon({
      marathonId: marathon.id,
    })
    const nowIso = new Date().toISOString()

    const marathonPublication = publications.find((publication) => publication.topicId === null)
    const publicationByTopicId = new Map(
      publications
        .filter((publication) => publication.topicId !== null)
        .map((publication) => [publication.topicId as number, publication]),
    )

    const topics: AdminGalleryTopic[] = marathon.topics
      .toSorted((a, b) => a.orderIndex - b.orderIndex)
      .map((topic) => {
        const publication = publicationByTopicId.get(topic.id)
        return {
          id: topic.id,
          name: topic.name,
          orderIndex: topic.orderIndex,
          scheduledEnd: topic.scheduledEnd,
          publishable: isByCameraTopicPublishable({ scheduledEnd: topic.scheduledEnd, nowIso }),
          published: publication?.publishedAt != null,
          publishedAt: publication?.publishedAt ?? null,
          featuredSections: publication?.featuredSections ?? [],
        }
      })

    return {
      marathon: toMarathonMeta(marathon),
      mode: marathon.mode,
      marathonPublished: marathonPublication?.publishedAt != null,
      marathonPublishedAt: marathonPublication?.publishedAt ?? null,
      marathonFeaturedSections: marathonPublication?.featuredSections ?? [],
      topics,
      competitionClasses: marathon.competitionClasses.map((competitionClass) => ({
        id: competitionClass.id,
        name: competitionClass.name,
      })),
      availableFeaturedSections: buildAvailableFeaturedSections(marathon),
    }
  })

  const setMarathonPublication: GalleryService['Service']['setMarathonPublication'] = Effect.fn(
    'GalleryService.setMarathonPublication',
  )(function* ({ domain, published }) {
    const marathon = yield* resolveMarathon(domain)

    if (marathon.mode === 'by-camera') {
      return yield* Effect.fail(
        new BadRequestError({
          message: 'By-camera galleries are published per topic, not marathon-wide',
        }),
      )
    }

    const existing = yield* galleryRepository.getPublication({
      marathonId: marathon.id,
      topicId: null,
    })
    const featuredSections = Option.match(existing, {
      onSome: (publication) => publication.featuredSections,
      onNone: () => [] as GalleryFeaturedSection[],
    })

    yield* galleryRepository.upsertPublication({
      marathonId: marathon.id,
      topicId: null,
      publishedAt: published ? new Date().toISOString() : null,
      featuredSections,
    })

    return { published }
  })

  const setTopicPublication: GalleryService['Service']['setTopicPublication'] = Effect.fn(
    'GalleryService.setTopicPublication',
  )(function* ({ domain, topicId, published }) {
    const marathon = yield* resolveMarathon(domain)

    if (marathon.mode !== 'by-camera') {
      return yield* Effect.fail(
        new BadRequestError({ message: 'Per-topic publication is only available in by-camera mode' }),
      )
    }

    const topic = marathon.topics.find((candidate) => candidate.id === topicId)
    if (!topic) {
      return yield* Effect.fail(
        new NotFoundError({ resource: 'Topic', identifier: { domain, topicId } }),
      )
    }

    const nowIso = new Date().toISOString()

    if (published && !isByCameraTopicPublishable({ scheduledEnd: topic.scheduledEnd, nowIso })) {
      return yield* Effect.fail(
        new PreconditionFailedError({
          message: 'A by-camera topic can only be published after its submission window closes',
        }),
      )
    }

    const existing = yield* galleryRepository.getPublication({ marathonId: marathon.id, topicId })
    const featuredSections = Option.match(existing, {
      onSome: (publication) => publication.featuredSections,
      onNone: () => [] as GalleryFeaturedSection[],
    })

    yield* galleryRepository.upsertPublication({
      marathonId: marathon.id,
      topicId,
      publishedAt: published ? nowIso : null,
      featuredSections,
    })

    return { published }
  })

  const updateFeaturedSections: GalleryService['Service']['updateFeaturedSections'] = Effect.fn(
    'GalleryService.updateFeaturedSections',
  )(function* ({ domain, topicId, featuredSections }) {
    const marathon = yield* resolveMarathon(domain)
    const normalizedTopicId = topicId ?? null

    const existing = yield* galleryRepository.getPublication({
      marathonId: marathon.id,
      topicId: normalizedTopicId,
    })
    const publishedAt = Option.match(existing, {
      onSome: (publication) => publication.publishedAt,
      onNone: () => null,
    })

    yield* galleryRepository.upsertPublication({
      marathonId: marathon.id,
      topicId: normalizedTopicId,
      publishedAt,
      featuredSections: [...featuredSections],
    })

    return { updated: true }
  })

  return GalleryService.of({
    getPublicGallery,
    getGalleryFeed,
    getByCameraTopicGallery,
    getGalleryParticipantSet,
    getGalleryAdminState,
    setMarathonPublication,
    setTopicPublication,
    updateFeaturedSections,
  })
})

export const GalleryServiceLayerNoDeps = Layer.effect(GalleryService, makeGalleryService)

export const GalleryServiceLayer = GalleryServiceLayerNoDeps.pipe(Layer.provide(DbLayer))
