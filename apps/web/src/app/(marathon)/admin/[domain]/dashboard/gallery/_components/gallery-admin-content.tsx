'use client'

import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { ExternalLink, Globe, Loader2, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useTRPC } from '@/lib/trpc/client'
import { useDomain } from '@/lib/domain-provider'
import { formatDomainLink } from '@/lib/utils'
import { revalidateGalleryPageCache } from '@/lib/gallery-page-cache.actions'
import { FeaturedSectionsEditor } from './featured-sections-editor'
import type {
  AdminGalleryTopic,
  AvailableFeaturedSection,
  FeaturedSectionConfig,
} from './gallery-admin-types'

export function GalleryAdminContent() {
  const trpc = useTRPC()
  const domain = useDomain()
  const queryClient = useQueryClient()

  const { data: state } = useSuspenseQuery(
    trpc.gallery.getGalleryAdminState.queryOptions({ domain }),
  )

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: trpc.gallery.getGalleryAdminState.pathKey() })

  const publicLink = formatDomainLink('/gallery', domain, 'gallery')
  const isByCamera = state.mode === 'by-camera'

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Gallery</h1>
        <p className="text-sm text-muted-foreground">
          Publish the public photo gallery and choose which winner sections to feature. The public
          gallery never exposes participant names, only reference numbers and display images.
        </p>
      </header>

      {isByCamera ? (
        <ByCameraControls topics={state.topics} domain={domain} onChange={invalidate} />
      ) : (
        <MarathonControls
          domain={domain}
          published={state.marathonPublished}
          publicLink={publicLink}
          availableFeaturedSections={state.availableFeaturedSections}
          featuredSections={state.marathonFeaturedSections}
          onChange={invalidate}
        />
      )}
    </div>
  )
}

function MarathonControls({
  domain,
  published,
  publicLink,
  availableFeaturedSections,
  featuredSections,
  onChange,
}: {
  domain: string
  published: boolean
  publicLink: string
  availableFeaturedSections: AvailableFeaturedSection[]
  featuredSections: FeaturedSectionConfig[]
  onChange: () => void
}) {
  const trpc = useTRPC()

  const mutation = useMutation(
    trpc.gallery.setMarathonPublication.mutationOptions({
      onSuccess: async (result) => {
        toast.success(result.published ? 'Gallery published' : 'Gallery unpublished')
        await revalidateGalleryPageCache({ domain })
        onChange()
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to update gallery publication')
      },
    }),
  )

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {published ? <Globe className="size-4" /> : <Lock className="size-4" />}
            Publication
          </CardTitle>
          <CardDescription>
            {published
              ? 'The gallery is live and publicly browsable.'
              : 'The gallery is private. Publish to make it publicly browsable.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Switch
              checked={published}
              disabled={mutation.isPending}
              onCheckedChange={(checked) => mutation.mutate({ domain, published: checked })}
              aria-label="Publish gallery"
            />
            <span className="text-sm text-muted-foreground">
              {mutation.isPending ? 'Saving…' : published ? 'Published' : 'Not published'}
            </span>
          </div>
          {published ? (
            <a
              href={publicLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:underline"
            >
              View public gallery <ExternalLink className="size-3.5" />
            </a>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Featured winners</CardTitle>
          <CardDescription>
            Curate the winner sections shown at the top of the gallery. Feature a topic or class,
            then enter the reference numbers of your top three winners in podium order.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FeaturedSectionsEditor
            domain={domain}
            topicId={null}
            available={availableFeaturedSections}
            current={featuredSections}
          />
        </CardContent>
      </Card>
    </>
  )
}

function ByCameraControls({
  topics,
  domain,
  onChange,
}: {
  topics: AdminGalleryTopic[]
  domain: string
  onChange: () => void
}) {
  if (topics.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No topics have been created yet.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {topics.map((topic) => (
        <ByCameraTopicCard key={topic.id} topic={topic} domain={domain} onChange={onChange} />
      ))}
    </div>
  )
}

function ByCameraTopicCard({
  topic,
  domain,
  onChange,
}: {
  topic: AdminGalleryTopic
  domain: string
  onChange: () => void
}) {
  const trpc = useTRPC()
  const publicLink = formatDomainLink(`/gallery/${topic.orderIndex}`, domain, 'gallery')

  const mutation = useMutation(
    trpc.gallery.setTopicPublication.mutationOptions({
      onSuccess: async (result) => {
        toast.success(result.published ? 'Topic gallery published' : 'Topic gallery unpublished')
        await revalidateGalleryPageCache({ domain, topicOrderIndex: topic.orderIndex })
        onChange()
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to update topic publication')
      },
    }),
  )

  const canPublish = topic.publishable || topic.published
  const disabledReason = !topic.publishable
    ? 'You can publish this topic gallery once its submission window has closed.'
    : null

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <CardTitle className="text-base">
              <span className="text-muted-foreground">Topic {topic.orderIndex + 1} · </span>
              {topic.name}
            </CardTitle>
            <CardDescription>
              {topic.published
                ? 'Published and publicly browsable.'
                : (disabledReason ?? 'Ready to publish.')}
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={topic.published}
              disabled={mutation.isPending || !canPublish}
              onCheckedChange={(checked) =>
                mutation.mutate({ domain, topicId: topic.id, published: checked })
              }
              aria-label={`Publish ${topic.name} gallery`}
            />
            {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          </div>
        </div>
      </CardHeader>
      {topic.published ? (
        <CardContent className="space-y-5">
          <a
            href={publicLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:underline"
          >
            View topic gallery <ExternalLink className="size-3.5" />
          </a>
          <div className="space-y-3 border-t border-border/60 pt-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Featured winners</p>
              <p className="text-xs text-muted-foreground">
                Enter the reference numbers of the top three winners for this topic in podium order.
              </p>
            </div>
            <FeaturedSectionsEditor
              domain={domain}
              topicId={topic.id}
              topicOrderIndex={topic.orderIndex}
              variant="single"
              available={[
                {
                  kind: 'by-camera-topic-winners',
                  title: `${topic.name} winners`,
                  topicId: topic.id,
                },
              ]}
              current={topic.featuredSections}
            />
          </div>
        </CardContent>
      ) : null}
    </Card>
  )
}
