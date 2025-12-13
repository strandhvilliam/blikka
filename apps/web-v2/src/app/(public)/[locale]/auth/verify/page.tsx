import { decodeSearchParams, Page } from "@/lib/next-utils"
import { Effect, Schema } from "effect"
import { VerifyForm } from "./verify-form"
import { redirect } from "next/navigation"

const _VerifyPage = Effect.fn("@blikka/web/VerifyPage")(
  function* ({ searchParams }: PageProps<"/[locale]/auth/verify">) {
    const params = yield* decodeSearchParams(
      Schema.Struct({
        email: Schema.String,
      })
    )(searchParams).pipe(Effect.catchAll(() => Effect.succeed({ email: null as string | null })))

    if (!params.email) {
      redirect("/auth/login?error=email_required")
    }

    return (
      <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
        <div className="w-full max-w-sm">
          <VerifyForm email={params.email} />
        </div>
      </div>
    )
  },
  Effect.catchAll(() => {
    redirect("/auth/login?error=verification_failed")
    return Effect.succeed(<div />)
  })
)

export default Page(_VerifyPage)
