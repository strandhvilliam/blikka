import { decodeParams, Page } from "@/lib/next-utils"
import { Effect, Schema } from "effect"
import { redirect } from "next/navigation"
import Image from "next/image"
import { CheckCircle2 } from "lucide-react"
import { getJuryInvitationForRoute } from "@/lib/jury/jury-server"
import { getJuryEntryPath } from "@/lib/jury/jury-utils"

const _JuryCompletedPage = Effect.fn("@blikka/web/JuryCompletedPage")(
  function* ({ params }: { params: Promise<{ domain: string; token: string }> }) {
    const { domain, token } = yield* decodeParams(
      Schema.Struct({ domain: Schema.String, token: Schema.String }),
    )(params)

    const invitation = yield* getJuryInvitationForRoute({ domain, token })

    if (invitation.status !== "completed") {
      return redirect(getJuryEntryPath(domain, token))
    }

    return (
      <div className="flex flex-col min-h-dvh relative overflow-hidden pt-4">
        <div className="z-20 flex flex-col flex-1 h-full">
          <main className="flex-1 px-6 pb-6 max-w-md mx-auto w-full flex flex-col justify-center">
            <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-6 border border-border shadow-xl">
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-green-600" />
                </div>
              </div>

              {invitation.marathon.logoUrl ? (
                <div className="w-20 h-20 rounded-full overflow-hidden shadow mx-auto mb-4 border">
                  <img
                    src={invitation.marathon.logoUrl}
                    alt={invitation.marathon.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : null}

              <h1 className="text-2xl font-bold text-center mb-2">Review completed</h1>
              <p className="text-muted-foreground text-center mb-6">
                Thank you, {invitation.displayName}. Your review for {invitation.marathon.name} has
                been recorded.
              </p>
              <div className="bg-muted rounded-xl p-4">
                <p className="text-sm text-muted-foreground text-center">
                  You can safely close this page. The organizing team can now continue with the jury
                  process.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col items-center">
              <p className="text-xs text-muted-foreground mb-1 italic">Powered by</p>
              <div className="flex items-center gap-1.5">
                <Image src="/blikka-logo.svg" alt="Blikka" width={20} height={17} />
                <span className="font-special-gothic text-base tracking-tight">blikka</span>
              </div>
            </div>
          </main>
        </div>
      </div>
    )
  },
  Effect.catch((error) =>
    Effect.succeed(<div>Error: {error instanceof Error ? error.message : String(error)}</div>),
  ),
)

export default Page(_JuryCompletedPage)
