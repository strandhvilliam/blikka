'use client'

import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { ExternalLink, Globe, Loader2, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { useTRPC } from '@/lib/trpc/client'
import { useDomain } from '@/lib/domain-provider'
import { formatDomainLink } from '@/lib/utils'
import { revalidateGalleryPageCache } from '@/lib/gallery-page-cache.actions'
import { FeaturedSectionsEditor } from './featured-sections-editor'
import { GalleryAdminHeader } from './gallery-admin-header'
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
    <div>
      <GalleryAdminHeader />

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
    <div className="space-y-8">
      <div className="rounded-xl border border-border bg-white px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/80 text-muted-foreground/60">
              {published ? (
                <Globe className="h-4 w-4" strokeWidth={1.8} />
              ) : (
                <Lock className="h-4 w-4" strokeWidth={1.8} />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-foreground">Publication</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
                {published
                  ? 'The gallery is live and publicly browsable.'
                  : 'The gallery is private. Publish to make it publicly browsable.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3">
              <Switch
                checked={published}
                disabled={mutation.isPending}
                onCheckedChange={(checked) => mutation.mutate({ domain, published: checked })}
                aria-label="Publish gallery"
              />
              <span className="text-[13px] text-muted-foreground">
                {mutation.isPending ? 'Saving…' : published ? 'Published' : 'Not published'}
              </span>
            </div>
            {published ? (
              <a
                href={publicLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground hover:underline"
              >
                View public gallery <ExternalLink className="size-3.5" />
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <section>
        <div className="mb-4 flex items-center gap-2.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-primary" />
          <p className="text-xs font-semibold uppercase tracking-widest text-foreground">
            Featured winners
          </p>
        </div>
        <p className="mb-5 max-w-lg text-[13px] leading-relaxed text-muted-foreground">
          Curate the winner sections shown at the top of the gallery. Feature a topic or class, then
          enter the reference numbers of your top three winners in podium order.
        </p>
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          <FeaturedSectionsEditor
            domain={domain}
            topicId={null}
            available={availableFeaturedSections}
            current={featuredSections}
          />
        </div>
      </section>
    </div>
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
      <div className="rounded-xl border border-border bg-white px-4 py-10 text-center text-[13px] text-muted-foreground">
        No topics have been created yet.
      </div>
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
    <div className="overflow-hidden rounded-xl border border-border bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold tracking-tight text-foreground">
            <span className="text-muted-foreground">Topic {topic.orderIndex + 1} · </span>
            {topic.name}
          </p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
            {topic.published
              ? 'Published and publicly browsable.'
              : (disabledReason ?? 'Ready to publish.')}
          </p>
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
          {mutation.isPending ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
        </div>
      </div>
      {topic.published ? (
        <div className="space-y-5 px-4 py-4 sm:px-5">
          <a
            href={publicLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground hover:underline"
          >
            View topic gallery <ExternalLink className="size-3.5" />
          </a>
          <div className="space-y-3 border-t border-border pt-4">
            <div className="space-y-0.5">
              <p className="text-[13px] font-medium text-foreground">Featured winners</p>
              <p className="text-[13px] text-muted-foreground">
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
        </div>
      ) : null}
    </div>
  )
}
