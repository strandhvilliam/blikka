import { decodeParams, Page } from "@/lib/next-utils"
import { Effect, Schema } from "effect"
import { HydrateClient, prefetch, trpc } from "@/lib/trpc/server"
import { Suspense } from "react"
import { Splash } from "@/components/splash"
import { notFound } from "next/navigation"
import { flowStateServerLoader } from "@/lib/flow-state-params-server"
import { ConfirmationClient } from "../_components/confirmation-client"

const _ConfirmationPage = Effect.fn("@blikka/web/ConfirmationPage")(
  function* ({ params, searchParams }: PageProps<"/live/[domain]">) {
    const { domain } = yield* decodeParams(Schema.Struct({ domain: Schema.String }))(params)
    const queryParams = yield* Effect.tryPromise(() => flowStateServerLoader(searchParams))

    if (!queryParams?.participantRef) {
      return notFound()
    }

    prefetch(
      trpc.participants.getPublicParticipantByReference.queryOptions({
        domain,
        reference: queryParams.participantRef,
      }),
    )
    return (
      <HydrateClient>
        <Suspense fallback={<Splash />}>
          <ConfirmationClient
            params={{
              participantRef: queryParams.participantRef,
              participantFirstName: queryParams.participantFirstName ?? "",
              participantLastName: queryParams.participantLastName ?? "",
            }}
          />
        </Suspense>
      </HydrateClient>
    )
  },
  Effect.catch((error) =>
    Effect.succeed(<div>Error: {error instanceof Error ? error.message : String(error)}</div>),
  ),
)

export default Page(_ConfirmationPage)
