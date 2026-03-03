import { Inter, Geist, Special_Gothic_Expanded_One, Special_Gothic } from "next/font/google"
import { ReactNode, Suspense } from "react"
import "../app/globals.css"

const geist = Geist({
  subsets: ["latin"],
  display: "swap",
})

const specialGothic = Special_Gothic_Expanded_One({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-special-gothic",
  fallback: ["sans-serif"],
})

const gothic = Special_Gothic({
  subsets: ["latin"],
  variable: "--font-gothic",
  fallback: ["sans-serif"],
})

type Props = {
  children: ReactNode
  locale: string
}

export default function Document({ children, locale }: Props) {
  return (
    <html className={`${geist.className} ${specialGothic.variable} ${gothic.variable} relative`} lang={locale}>
      <body>{children}</body>
    </html>
  )
}
