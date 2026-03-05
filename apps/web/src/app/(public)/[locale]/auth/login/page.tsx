import { LoginForm } from "./login-form"
import { getAppSession } from "@/lib/auth/server"
import { decodeSearchParams, Page } from "@/lib/next-utils"
import { Effect, Option, Schema } from "effect"
import { redirect } from "next/navigation"

const _LoginPage = Effect.fn("@blikka/web/LoginPage")(
  function* ({ searchParams }: PageProps<"/[locale]/auth/login">) {
    const session = yield* getAppSession()
    const params = yield* decodeSearchParams(
      Schema.Struct({
        next: Schema.optional(Schema.String),
      })
    )(searchParams).pipe(Effect.catch(() => Effect.succeed({ next: undefined })))

    if (Option.isSome(session)) {
      redirect(params.next ?? "/admin")
    }

    return (
      <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
        <div className="w-full max-w-sm">
          <LoginForm next={params.next} />
        </div>
      </div>
    )
  },
  Effect.catch(() => Effect.succeed(<div />))
)

export default Page(_LoginPage)
