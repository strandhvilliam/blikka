import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@blikka/api/trpc'

type Outputs = inferRouterOutputs<AppRouter>

export type PublicGallery = Outputs['gallery']['getPublicGallery']
export type GalleryFeedResult = Outputs['gallery']['getGalleryFeed']
export type GalleryPhotoCard = GalleryFeedResult['items'][number]
export type ByCameraTopicGallery = Outputs['gallery']['getByCameraTopicGallery']
export type GalleryParticipantSetResult = Outputs['gallery']['getGalleryParticipantSet']
export type ResolvedFeaturedSection = PublicGallery['featuredSections'][number]
export type GalleryParticipantSetCard = ResolvedFeaturedSection['participantSets'][number]
export type GalleryPublicSubmission = GalleryParticipantSetResult['submissions'][number]
export type GalleryTopicMeta = PublicGallery['topics'][number]
export type GalleryClassMeta = PublicGallery['competitionClasses'][number]
export type GalleryMarathonMeta = PublicGallery['marathon']
