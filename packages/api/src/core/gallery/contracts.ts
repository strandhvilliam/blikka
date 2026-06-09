import { Schema } from 'effect'

export const GalleryFeaturedSectionSchema = Schema.Struct({
  id: Schema.String,
  kind: Schema.Literals(['topic-winners', 'class-winners', 'by-camera-topic-winners']),
  enabled: Schema.Boolean,
  order: Schema.Number,
  topicId: Schema.optional(Schema.Number),
  competitionClassId: Schema.optional(Schema.Number),
  picks: Schema.optional(Schema.Array(Schema.String)),
})

export const GetPublicGallerySchema = Schema.Struct({
  domain: Schema.String,
})

export const GetGalleryFeedSchema = Schema.Struct({
  domain: Schema.String,
  topicOrderIndex: Schema.optional(Schema.NullOr(Schema.Number)),
  competitionClassId: Schema.optional(Schema.NullOr(Schema.Number)),
  cursor: Schema.optional(Schema.NullOr(Schema.String)),
  limit: Schema.optional(Schema.Number),
})

export const GetByCameraTopicGallerySchema = Schema.Struct({
  domain: Schema.String,
  topicOrderIndex: Schema.Number,
})

export const GetGalleryParticipantSetSchema = Schema.Struct({
  domain: Schema.String,
  reference: Schema.String,
})

export const GetGalleryReferencePreviewSchema = Schema.Struct({
  domain: Schema.String,
  reference: Schema.String,
})

export const GetGalleryAdminStateSchema = Schema.Struct({
  domain: Schema.String,
})

export const SetMarathonPublicationSchema = Schema.Struct({
  domain: Schema.String,
  published: Schema.Boolean,
})

export const SetTopicPublicationSchema = Schema.Struct({
  domain: Schema.String,
  topicId: Schema.Number,
  published: Schema.Boolean,
})

export const UpdateFeaturedSectionsSchema = Schema.Struct({
  domain: Schema.String,
  topicId: Schema.optional(Schema.NullOr(Schema.Number)),
  featuredSections: Schema.Array(GalleryFeaturedSectionSchema),
})

export type GetPublicGallery = Schema.Schema.Type<typeof GetPublicGallerySchema>
export type GetGalleryFeed = Schema.Schema.Type<typeof GetGalleryFeedSchema>
export type GetByCameraTopicGallery = Schema.Schema.Type<typeof GetByCameraTopicGallerySchema>
export type GetGalleryParticipantSet = Schema.Schema.Type<typeof GetGalleryParticipantSetSchema>
export type GetGalleryReferencePreview = Schema.Schema.Type<typeof GetGalleryReferencePreviewSchema>
export type GetGalleryAdminState = Schema.Schema.Type<typeof GetGalleryAdminStateSchema>
export type SetMarathonPublication = Schema.Schema.Type<typeof SetMarathonPublicationSchema>
export type SetTopicPublication = Schema.Schema.Type<typeof SetTopicPublicationSchema>
export type UpdateFeaturedSections = Schema.Schema.Type<typeof UpdateFeaturedSectionsSchema>
