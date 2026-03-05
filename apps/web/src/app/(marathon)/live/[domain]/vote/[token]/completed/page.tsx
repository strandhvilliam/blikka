import { decodeParams, Page } from "@/lib/next-utils";
import { Effect, Schema } from "effect";
import { HydrateClient, prefetch, trpc } from "@/lib/trpc/server";
import { CheckCircle2 } from "lucide-react";
import { fetchEffectQuery } from "@/lib/trpc/server";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { formatDomainPathname } from "@/lib/utils";

// Helper function to obfuscate email for privacy
function obfuscateEmail(email: string): string {
  if (!email || !email.includes("@")) return email;

  const [localPart, domain] = email.split("@");
  if (!domain) return email;

  // Show first character of local part, then ***
  const obfuscatedLocal = localPart.length > 1 ? `${localPart[0]}***` : "***";

  // For domain, show *** before the TLD
  const domainParts = domain.split(".");
  if (domainParts.length >= 2) {
    const tld = domainParts.pop(); // Get the TLD (.com, .org, etc.)
    const obfuscatedDomain = `***.${tld}`;
    return `${obfuscatedLocal}@${obfuscatedDomain}`;
  }

  return `${obfuscatedLocal}@***`;
}

const VotingCompletedPage = Effect.fn("@blikka/web/VotingCompletedPage")(
  function* ({
    params,
  }: {
    params: Promise<{ domain: string; token: string }>;
  }) {
    const { domain, token } = yield* decodeParams(
      Schema.Struct({ domain: Schema.String, token: Schema.String }),
    )(params);

    const votingSession = yield* fetchEffectQuery(
      trpc.voting.getVotingSession.queryOptions({ token, domain }),
    ).pipe(
      Effect.catch((error) => {
        console.error("Failed to fetch voting session:", error);
        return Effect.fail(notFound());
      }),
    );

    if (!votingSession.voteSubmissionId || !votingSession.votedAt) {
      return redirect(formatDomainPathname(`/live/vote/${token}`, domain, 'live'));
    }

    const firstName = votingSession?.firstName ?? "";
    const email = votingSession?.email ?? "";
    const obfuscatedEmail = obfuscateEmail(email);

    prefetch(trpc.voting.getVotingSession.queryOptions({ token, domain }));

    return (
      <HydrateClient>
        <div className="flex flex-col min-h-dvh relative overflow-hidden pt-4">
          <div className="z-20 flex flex-col flex-1 h-full">
            <main className="flex-1 px-6 pb-6 max-w-md mx-auto w-full flex flex-col justify-center">
              <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-6 border border-border shadow-xl">
                <div className="flex justify-center mb-6">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-10 h-10 text-green-600" />
                  </div>
                </div>
                <h1 className="text-2xl font-bold text-center mb-2">
                  {firstName ? `Thank you, ${firstName}!` : "Thank you!"}
                </h1>
                <p className="text-muted-foreground text-center mb-6">
                  Your vote has been recorded successfully.
                </p>
                <div className="bg-muted rounded-xl p-4 mb-4">
                  <p className="text-sm text-muted-foreground text-center">
                    Voting results will be announced after the voting period
                    ends. Stay tuned!
                  </p>
                </div>
                {email && (
                  <p className="text-xs text-muted-foreground text-center">
                    A confirmation has been sent to {obfuscatedEmail}
                  </p>
                )}
              </div>

              {/* Powered by Blikka */}
              <div className="mt-6 flex flex-col items-center">
                <p className="text-xs text-muted-foreground mb-1 italic">
                  Powered by
                </p>
                <div className="flex items-center gap-1.5">
                  <Image
                    src="/blikka-logo.svg"
                    alt="Blikka"
                    width={20}
                    height={17}
                  />
                  <span className="font-rocgrotesk font-bold text-base tracking-tight">
                    blikka
                  </span>
                </div>
              </div>
            </main>
          </div>
        </div>
      </HydrateClient>
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

export default Page(VotingCompletedPage);
