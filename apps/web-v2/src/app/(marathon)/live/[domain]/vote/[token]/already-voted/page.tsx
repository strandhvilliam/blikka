import { decodeParams, Page } from "@/lib/next-utils";
import { Effect, Schema } from "effect";
import { HydrateClient, prefetch, trpc } from "@/lib/trpc/server";
import { CheckCircle2 } from "lucide-react";

const AlreadyVotedPage = Effect.fn("@blikka/web/AlreadyVotedPage")(
  function* ({
    params,
  }: PageProps<"/live/[domain]/vote/[token]/already-voted">) {
    const { domain, token } = yield* decodeParams(
      Schema.Struct({ domain: Schema.String, token: Schema.String }),
    )(params);

    prefetch(trpc.voting.getVotingSubmissions.queryOptions({ token, domain }));

    return (
      <HydrateClient>
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-primary" />
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-2">Vote Already Submitted</h1>
            <p className="text-muted-foreground mb-6">
              You have already cast your vote for this marathon. Thank you for
              participating!
            </p>
            <div className="bg-muted rounded-lg p-4 mb-6">
              <p className="text-sm text-muted-foreground">
                Your vote has been recorded and counted. Results will be
                announced after voting closes.
              </p>
            </div>
          </div>
        </div>
      </HydrateClient>
    );
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
