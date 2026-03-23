import { decodeParams, Page } from "@/lib/next-utils"
import { Effect, Schema } from "effect"
import { HydrateClient, prefetch, trpc } from "@/lib/trpc/server"
import { CheckCircle2 } from "lucide-react"
import { fetchEffectQuery } from "@/lib/trpc/server"
import Image from "next/image"
import { notFound, redirect } from "next/navigation"
import { formatDomainPathname } from "@/lib/utils"

function obfuscateEmail(email: string): string {
  if (!email || !email.includes("@")) return email

  const [localPart, domain] = email.split("@")
  if (!domain) return email

  const obfuscatedLocal = localPart.length > 1 ? `${localPart[0]}***` : "***"

  const domainParts = domain.split(".")
  if (domainParts.length >= 2) {
    const tld = domainParts.pop()
    const obfuscatedDomain = `***.${tld}`
    return `${obfuscatedLocal}@${obfuscatedDomain}`
  }

  return `${obfuscatedLocal}@***`
}

const VotingCompletedPage = Effect.fn("@blikka/web/VotingCompletedPage")(
  function* ({
    params,
  }: {
    params: Promise<{ domain: string; token: string }>
  }) {
    const { domain, token } = yield* decodeParams(
      Schema.Struct({ domain: Schema.String, token: Schema.String }),
    )(params)

    const votingSession = yield* fetchEffectQuery(
      trpc.voting.getVotingSession.queryOptions({ token }),
    ).pipe(
      Effect.catch((error) => {
        console.error("Failed to fetch voting session:", error)
        return Effect.fail(notFound())
      }),
    )

    const sessionDomain = votingSession.marathon?.domain

    if (sessionDomain && sessionDomain !== domain) {
      return redirect(
        formatDomainPathname(`/live/vote/${token}/completed`, sessionDomain, "live"),
      )
    }

    if (!votingSession.voteSubmissionId || !votingSession.votedAt) {
      return redirect(formatDomainPathname(`/live/vote/${token}`, domain, "live"))
    }

    const firstName = votingSession?.firstName ?? ""
    const email = votingSession?.email ?? ""
    const obfuscatedEmail = obfuscateEmail(email)

    prefetch(trpc.voting.getVotingSession.queryOptions({ token }))

    return (
      <HydrateClient>
        <div className="flex min-h-dvh flex-col pt-4">
          <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-6">
            <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)]">
              <div className="p-6">
                {/* Success icon */}
                <div className="mb-6 flex justify-center">
                  <div className="relative flex h-16 w-16 items-center justify-center">
                    <div className="absolute inset-0 animate-ping rounded-full bg-emerald-500/10" />
                    <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
                      <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                    </div>
                  </div>
                </div>

                <h1 className="text-center font-gothic text-2xl font-medium tracking-tight text-foreground">
                  {firstName ? `Thank you, ${firstName}!` : "Thank you!"}
                </h1>
                <p className="mt-2 text-center text-sm text-muted-foreground">
                  Your vote has been recorded successfully.
                </p>

                <div className="mt-6 rounded-xl bg-muted/30 p-4">
                  <p className="text-center text-sm text-muted-foreground">
                    Voting results will be announced after the voting period ends. Stay tuned!
                  </p>
                </div>

                {email && (
                  <p className="mt-4 text-center text-xs text-muted-foreground">
                    A confirmation has been sent to {obfuscatedEmail}
                  </p>
                )}
              </div>
            </div>

            {/* Powered by */}
            <div className="mt-6 flex flex-col items-center">
              <p className="mb-1 text-xs italic text-muted-foreground">Powered by</p>
              <div className="flex items-center gap-1.5">
                <Image src="/blikka-logo.svg" alt="Blikka" width={20} height={17} />
                <span className="font-special-gothic text-base tracking-tight">blikka</span>
              </div>
            </div>
          </main>
        </div>
      </HydrateClient>
    )
  },
  Effect.catch((error) =>
    Effect.succeed(
      <div>Error: {error instanceof Error ? error.message : String(error)}</div>,
    ),
  ),
)

export default Page(VotingCompletedPage)
