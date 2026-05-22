import { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { notFound } from 'next/navigation'
import Document from '@/components/document'
import { SmoothScrollProvider } from '@/components/smooth-scroll-provider'
import { APP_TIME_ZONE, LOCALES } from '@/config'
import { Suspense } from 'react'
import { DotPattern } from '@/components/dot-pattern'
import { PublicLocaleSwitcherFloating } from './_components/public-locale-switcher'
import Loading from './loading'

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

export const metadata: Metadata = {
  title: 'Blikka - Photo Marathon Platform for the People',
}

export default function PublicLocaleLayout(props: LayoutProps<'/[locale]'>) {
  return (
    <Suspense fallback={<Loading />}>
      <PublicLocaleLayoutContent {...props} />
    </Suspense>
  )
}

async function PublicLocaleLayoutContent({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params
  if (!LOCALES.includes(locale)) notFound()

  return (
    <Document locale={locale}>
      <DotPattern />
      <NextIntlClientProvider timeZone={APP_TIME_ZONE}>
        <PublicLocaleSwitcherFloating />
        <SmoothScrollProvider>{children}</SmoothScrollProvider>
      </NextIntlClientProvider>
    </Document>
  )
}
