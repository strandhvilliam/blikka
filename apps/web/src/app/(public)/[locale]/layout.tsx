import { Metadata } from "next"
import { NextIntlClientProvider } from "next-intl"
import { notFound } from "next/navigation"
import Document from "@/components/document"
import { SmoothScrollProvider } from "@/components/smooth-scroll-provider"
import { LOCALES } from "@/config"
import { Suspense } from "react"
import { DotPattern } from "@/components/dot-pattern"

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

export const metadata: Metadata = {
  title: "Blikka - Photo Marathon Platform for the People",
}


export default async function PublicLocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params
  if (!LOCALES.includes(locale)) notFound()

  return (
    <Document locale={locale}>
      <DotPattern />
      <Suspense fallback={
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-2xl">
          <img src="/blikka-logo-dark.svg" alt="blikka" width={48} height={40} className="h-10 w-auto animate-pulse" />
        </div>
      }>
        <NextIntlClientProvider>
          <SmoothScrollProvider>{children}</SmoothScrollProvider>
        </NextIntlClientProvider>
      </Suspense>
    </Document>
  )
}

// export default function LayoutWithSuspense(props: LayoutProps<"/[locale]">) {
//   return (
//     <Suspense fallback={<Loading />}>
//       <LocaleLayout {...props} />
//     </Suspense>
//   )
// }
