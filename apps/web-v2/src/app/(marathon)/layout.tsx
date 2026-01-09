import { Layout } from "@/lib/next-utils"
import { Effect } from "effect"
import Document from "@/components/document"
import { getHeaders, getLocale } from "@/lib/server-utils"
import { Providers } from "./providers"

import { getI18nMessages } from "@/i18n/utils"
import { Toaster } from "sonner"
import { DotPattern } from "@/components/dot-pattern"

const _MarathonLayout = Effect.fn("@blikka/web/MarathonLayout")(
  function* ({ children }: LayoutProps<"/">) {
    const [locale, messages] = yield* Effect.all([getLocale(), getI18nMessages()])
    const headers = yield* getHeaders()
    const domain = headers.get("x-marathon-domain")
    return (
      <Document locale={locale}>
        <Providers locale={locale} messages={messages} domain={domain}>
          <DotPattern />
          <Toaster />
          {children}
        </Providers>
      </Document>
    )
  },
  Effect.catchAll((error) => Effect.succeed(<div>Error: {error.message}</div>))
)

export default Layout(_MarathonLayout)
