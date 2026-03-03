"use client"

import { TRPCReactProvider } from "@/lib/trpc/client"
import { NextIntlClientProvider } from "next-intl"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { NuqsAdapter } from "nuqs/adapters/next/app"

export function Providers({
  children,
  locale,
  messages,
  domain,
}: {
  children: React.ReactNode
  locale: string
  messages: Record<string, unknown>
  domain: string | null
}) {
  return (
    <NuqsAdapter>
      <NextIntlClientProvider locale={locale} messages={messages}>
        <TRPCReactProvider domain={domain}>
          <ReactQueryDevtools initialIsOpen={false} />
          {children}
        </TRPCReactProvider>
      </NextIntlClientProvider>
    </NuqsAdapter>
  )
}
