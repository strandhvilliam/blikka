"use client"

import { TRPCReactProvider } from "@/lib/trpc/client"
import { APP_TIME_ZONE } from "@/config"
import { NextIntlClientProvider } from "next-intl"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { NuqsAdapter } from "nuqs/adapters/next/app"
import { RealtimeProvider } from "@upstash/realtime/client"

export function Providers({
  children,
  locale,
  messages,
  domain,
  requestCookieHeader,
}: {
  children: React.ReactNode
  locale: string
  messages: Record<string, unknown>
  domain: string | null
  requestCookieHeader?: string | null
}) {
  return (
    <NuqsAdapter>
      <NextIntlClientProvider locale={locale} messages={messages} timeZone={APP_TIME_ZONE}>
        <TRPCReactProvider domain={domain} requestCookieHeader={requestCookieHeader}>
          {/* <ReactQueryDevtools initialIsOpen={false} /> */}
          <RealtimeProvider>{children}</RealtimeProvider>
        </TRPCReactProvider>
      </NextIntlClientProvider>
    </NuqsAdapter>
  )
}
