import { Metadata } from "next"
import { NextIntlClientProvider } from "next-intl"
import Document from "@/components/document"
import { LOCALES } from "@/config"
import { Effect, Schema } from "effect"
import { Layout, decodeParams } from "@/lib/next-utils"

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

export const metadata: Metadata = {
  title: "next-intl-mixed-routing (public)",
}

const _LocaleLayout = Effect.fn("@blikka/web/LocaleLayout")(
  function* ({ children, params }: LayoutProps<"/[locale]">) {
    const { locale } = yield* decodeParams(Schema.Struct({ locale: Schema.String }))(params)
    return (
      <Document locale={locale}>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </Document>
    )
  },
  Effect.catchAll((error) => Effect.succeed(<div>Error: {error.message}</div>))
)

export default Layout(_LocaleLayout)

// export default function LayoutWithSuspense(props: LayoutProps<"/[locale]">) {
//   return (
//     <Suspense fallback={<Loading />}>
//       <LocaleLayout {...props} />
//     </Suspense>
//   )
// }
