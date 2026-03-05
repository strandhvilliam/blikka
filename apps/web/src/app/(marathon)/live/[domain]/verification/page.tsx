import { decodeParams } from "@/lib/next-utils"
import { Suspense } from "react"
import { Effect, Schema } from "effect"
import { HydrateClient } from "@/lib/trpc/server"
import { Page } from "@/lib/next-utils"
import { getQueryClient, prefetch, trpc } from "@/lib/trpc/server"
import { Splash } from "@/components/splash"
import { flowStateServerLoader, flowStateServerParamSerializer } from "@/lib/flow-state-params-server"
import { notFound, redirect } from "next/navigation"
import { VerificationClient } from "../_components/verification-client"
import { formatDomainPathname } from "@/lib/utils";

const _VerificationPage = Effect.fn("@blikka/web/VerificationPage")(
  function*({ params, searchParams }: PageProps<"/live/[domain]/verification">) {
    const { domain } = yield* decodeParams(Schema.Struct({ domain: Schema.String }))(params)
    const queryParams = yield* Effect.tryPromise(() => flowStateServerLoader(searchParams))

    if (!queryParams?.participantRef) {
      return notFound()
    }

    prefetch(
      trpc.participants.getPublicParticipantByReference.queryOptions({
        domain,
        reference: queryParams.participantRef,
      })
    )

    const queryClient = getQueryClient()
    const participant = yield* Effect.tryPromise(() =>
      queryClient.fetchQuery(
        trpc.participants.getPublicParticipantByReference.queryOptions({
          domain,
          reference: queryParams.participantRef!,
        })
      )
    )

    if (!participant) {
      return notFound()
    }

    // If already verified, redirect to confirmation
    if (participant.status === "verified") {
      const redirectParams = flowStateServerParamSerializer(queryParams)
      redirect(formatDomainPathname(`/live/confirmation${redirectParams}`, domain))
    }

    return (
      <HydrateClient>
        <Suspense fallback={<Splash />}>
          <VerificationClient
            participantRef={queryParams.participantRef}
            participantId={queryParams.participantId ?? undefined}
          />
        </Suspense>
      </HydrateClient>
    )
  },
  Effect.catch((error) =>
    Effect.succeed(<div>Error: {error instanceof Error ? error.message : String(error)}</div>)
  )
)

export default Page(_VerificationPage)
