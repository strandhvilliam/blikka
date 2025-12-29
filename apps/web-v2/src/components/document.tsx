import { Inter, Geist } from "next/font/google"
import { ReactNode, Suspense } from "react"
import "../app/globals.css"

const geist = Geist({
  subsets: ["latin"],
  display: "swap",
})

type Props = {
  children: ReactNode
  locale: string
}

export default function Document({ children, locale }: Props) {
  return (
    <html className={`${geist.className} relative`} lang={locale}>
      <body>{children}</body>
    </html>
  )
}
