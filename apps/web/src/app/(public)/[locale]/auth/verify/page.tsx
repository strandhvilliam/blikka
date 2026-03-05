import { decodeSearchParams, Page } from "@/lib/next-utils"
import { getAppSession } from "@/lib/auth/server"
import { Effect, Option, Schema } from "effect"
import { VerifyForm } from "./verify-form"
import { redirect } from "next/navigation"

const _VerifyPage = Effect.fn("@blikka/web/VerifyPage")(
  function* ({ searchParams }: PageProps<"/[locale]/auth/verify">) {
    const session = yield* getAppSession()
    const params = yield* decodeSearchParams(
      Schema.Struct({
        email: Schema.String,
        next: Schema.optional(Schema.String),
      })
    )(searchParams).pipe(
      Effect.catch(() =>
        Effect.succeed({
          email: null as string | null,
          next: undefined as string | undefined,
        })
      )
    )

    if (Option.isSome(session)) {
      redirect(params.next ?? "/admin")
    }

    if (!params.email) {
      redirect("/auth/login?error=email_required")
    }

    return (
      <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
        <div className="w-full max-w-sm">
          <VerifyForm email={params.email} next={params.next} />
        </div>
      </div>
    )
  },
  Effect.catch(() => {
    redirect("/auth/login?error=verification_failed")
    return Effect.succeed(<div />)
  })
)

export default Page(_VerifyPage)
