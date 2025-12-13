"use client"

import { TRPCReactProvider } from "@/lib/trpc/client"
import { NextIntlClientProvider } from "next-intl"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"

export function Providers({
  children,
  locale,
  messages,
}: {
  children: React.ReactNode
  locale: string
  messages: Record<string, unknown>
}) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <TRPCReactProvider>
        <ReactQueryDevtools initialIsOpen={false} />

        {children}
      </TRPCReactProvider>
    </NextIntlClientProvider>
  )
}
