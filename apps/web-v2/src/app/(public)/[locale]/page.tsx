import { getTranslations } from "next-intl/server"
import { LocaleSwitcher } from "./locale-switcher"
import { Effect } from "effect"
import { Page } from "@/lib/next-utils"

const _HomePage = Effect.fn("@blikka/web/HomePage")(
  function* () {
    const t = yield* Effect.tryPromise(() => getTranslations("HomePage"))
    return (
      <div>
        <h1>{t("title")}</h1>
        <LocaleSwitcher />
      </div>
    )
  },
  Effect.catchAll((error) => Effect.succeed(<div>Error: {error.message}</div>))
)

export default Page(_HomePage)
