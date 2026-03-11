import { decodeParams, Page } from "@/lib/next-utils";
import { flowStateServerLoader } from "@/lib/flow-state-params-server";
import { Effect, Schema } from "effect";
import { notFound } from "next/navigation";

import { PrepareCompletedClient } from "../_components/prepare-completed-client";

const _PrepareCompletedPage = Effect.fn("@blikka/web/PrepareCompletedPage")(
  function* ({ params, searchParams }: PageProps<"/live/[domain]">) {
    const { domain } = yield* decodeParams(
      Schema.Struct({ domain: Schema.String }),
    )(params);
    const queryParams = yield* Effect.tryPromise(() =>
      flowStateServerLoader(searchParams),
    );

    if (!queryParams?.participantRef) {
      return notFound();
    }

    return (
      <PrepareCompletedClient
        domain={domain}
        params={{
          participantRef: queryParams.participantRef,
          participantFirstName: queryParams.participantFirstName ?? "",
          participantLastName: queryParams.participantLastName ?? "",
          participantEmail: queryParams.participantEmail ?? "",
        }}
      />
    );
  },
  Effect.catch((error) =>
    Effect.succeed(
      <div>
        Error: {error instanceof Error ? error.message : String(error)}
      </div>,
    ),
  ),
);

export default Page(_PrepareCompletedPage);
