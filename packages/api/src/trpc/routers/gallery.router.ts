import { Effect, Schema } from 'effect'
import {
  GetByCameraTopicGallerySchema,
  GetGalleryAdminStateSchema,
  GetGalleryFeedSchema,
  GetGalleryParticipantSetSchema,
  GetGalleryReferencePreviewSchema,
  GetPublicGallerySchema,
  SetMarathonPublicationSchema,
  SetTopicPublicationSchema,
  UpdateFeaturedSectionsSchema,
} from '../../core/gallery/contracts'
import { trpcEffect } from '../utils'
import {
  createTRPCRouter,
  domainProcedure,
  publicProcedure,
  requireMatchingInputDomainMiddleware,
} from '../root'
import { GalleryService } from '../../core/gallery/service'

export const galleryRouter = createTRPCRouter({
  getPublicGallery: publicProcedure.input(Schema.toStandardSchemaV1(GetPublicGallerySchema)).query(
    trpcEffect(
      Effect.fn('GalleryRouter.getPublicGallery')(function* ({ input }) {
        return yield* GalleryService.use((s) => s.getPublicGallery(input))
      }),
    ),
  ),

  getGalleryFeed: publicProcedure.input(Schema.toStandardSchemaV1(GetGalleryFeedSchema)).query(
    trpcEffect(
      Effect.fn('GalleryRouter.getGalleryFeed')(function* ({ input }) {
        return yield* GalleryService.use((s) => s.getGalleryFeed(input))
      }),
    ),
  ),

  getByCameraTopicGallery: publicProcedure
    .input(Schema.toStandardSchemaV1(GetByCameraTopicGallerySchema))
    .query(
      trpcEffect(
        Effect.fn('GalleryRouter.getByCameraTopicGallery')(function* ({ input }) {
          return yield* GalleryService.use((s) => s.getByCameraTopicGallery(input))
        }),
      ),
    ),

  getGalleryParticipantSet: publicProcedure
    .input(Schema.toStandardSchemaV1(GetGalleryParticipantSetSchema))
    .query(
      trpcEffect(
        Effect.fn('GalleryRouter.getGalleryParticipantSet')(function* ({ input }) {
          return yield* GalleryService.use((s) => s.getGalleryParticipantSet(input))
        }),
      ),
    ),

  getGalleryReferencePreview: domainProcedure
    .input(Schema.toStandardSchemaV1(GetGalleryReferencePreviewSchema))
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn('GalleryRouter.getGalleryReferencePreview')(function* ({ input }) {
          return yield* GalleryService.use((s) => s.getGalleryReferencePreview(input))
        }),
      ),
    ),

  getGalleryAdminState: domainProcedure
    .input(Schema.toStandardSchemaV1(GetGalleryAdminStateSchema))
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn('GalleryRouter.getGalleryAdminState')(function* ({ input }) {
          return yield* GalleryService.use((s) => s.getGalleryAdminState(input))
        }),
      ),
    ),

  setMarathonPublication: domainProcedure
    .input(Schema.toStandardSchemaV1(SetMarathonPublicationSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn('GalleryRouter.setMarathonPublication')(function* ({ input }) {
          return yield* GalleryService.use((s) => s.setMarathonPublication(input))
        }),
      ),
    ),

  setTopicPublication: domainProcedure
    .input(Schema.toStandardSchemaV1(SetTopicPublicationSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn('GalleryRouter.setTopicPublication')(function* ({ input }) {
          return yield* GalleryService.use((s) => s.setTopicPublication(input))
        }),
      ),
    ),

  updateFeaturedSections: domainProcedure
    .input(Schema.toStandardSchemaV1(UpdateFeaturedSectionsSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn('GalleryRouter.updateFeaturedSections')(function* ({ input }) {
          return yield* GalleryService.use((s) => s.updateFeaturedSections(input))
        }),
      ),
    ),
})
