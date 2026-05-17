import Document from "@/components/document"
import { Providers } from "./providers"

import { getLocale, getMessages } from "next-intl/server"
import { headers } from "next/headers"
import { Toaster } from "sonner"
import { DotPattern } from "@/components/dot-pattern"

export default async function MarathonLayout({ children }: LayoutProps<"/">) {
  const [locale, messages, requestHeaders] = await Promise.all([
    getLocale(),
    getMessages(),
    headers(),
  ])

  const domain = requestHeaders.get("x-marathon-domain")
  const requestCookieHeader = requestHeaders.get("cookie")

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
