import Document from "@/components/document"
import { getHeaders, getLocale } from "@/lib/server-utils"
import { Providers } from "./providers"

import { getI18nMessages } from "@/i18n/utils"
import { Toaster } from "sonner"
import { DotPattern } from "@/components/dot-pattern"
import { serverRuntime } from "@/lib/server-runtime"

export default async function MarathonLayout({ children }: LayoutProps<"/">) {
  const [locale, messages, headers] = await Promise.all([
    serverRuntime.runPromise(getLocale()),
    serverRuntime.runPromise(getI18nMessages()),
    serverRuntime.runPromise(getHeaders()),
  ])

  const domain = headers.get("x-marathon-domain")
  const requestCookieHeader = headers.get("cookie")

  return (
    <Document locale={locale}>
      <Providers
        locale={locale}
        messages={messages}
        domain={domain}
        requestCookieHeader={requestCookieHeader}
      >
        <DotPattern />
        <Toaster />
        {children}
      </Providers>
    </Document>
  )
}
