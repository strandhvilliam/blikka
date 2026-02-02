import { decodeParams, Page } from "@/lib/next-utils";
import { Effect, Schema } from "effect";
import { redirect } from "next/navigation";

const AlreadyVotedPage = Effect.fn("@blikka/web/AlreadyVotedPage")(
  function* ({
    params,
  }: PageProps<"/live/[domain]/vote/[token]/already-voted">) {
    const { domain, token } = yield* decodeParams(
      Schema.Struct({ domain: Schema.String, token: Schema.String }),
    )(params);

    // Redirect to voting-completed page
    return redirect(`/live/${domain}/vote/${token}/voting-completed`);
  },
  Effect.catchAll((error) =>
    Effect.succeed(
      <div>
        Error: {error instanceof Error ? error.message : String(error)}
      </div>,
    ),
  ),
);

export default Page(AlreadyVotedPage);
