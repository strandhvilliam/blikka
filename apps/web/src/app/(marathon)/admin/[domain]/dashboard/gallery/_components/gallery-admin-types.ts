import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@blikka/api/trpc'

type Outputs = inferRouterOutputs<AppRouter>

export type GalleryAdminState = Outputs['gallery']['getGalleryAdminState']
export type AdminGalleryTopic = GalleryAdminState['topics'][number]
export type AvailableFeaturedSection = GalleryAdminState['availableFeaturedSections'][number]
export type FeaturedSectionConfig = AdminGalleryTopic['featuredSections'][number]
