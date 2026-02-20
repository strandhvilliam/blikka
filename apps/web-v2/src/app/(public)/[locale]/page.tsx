import { Navbar } from "./_components/navbar"
import { Hero } from "./_components/hero"
import { Stats } from "./_components/stats"
import { LogoStrip } from "./_components/logo-strip"
import { Features } from "./_components/features"
import { HowItWorks } from "./_components/how-it-works"
import { Gallery } from "./_components/gallery"
import { SocialProof } from "./_components/social-proof"
import { GetStarted } from "./_components/get-started"
import { Footer } from "./_components/footer"
import { CookieConsent } from "@/components/blocks/cookie-consent"

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <Stats />
      <LogoStrip />
      <Features />
      <HowItWorks />
      <Gallery />
      <SocialProof />
      <GetStarted />
      <Footer />
      <CookieConsent
        cardClassName="bg-brand-white"
        acceptButtonClassName="bg-brand-black text-brand-white"
        declineButtonClassName="border border-brand-black/20 text-brand-black"
        variant="small" className="sm:left-auto sm:right-4" />
    </main>
  )
}
