import { Navbar } from "./_components/navbar"
import { Hero } from "./_components/hero"
import { Features } from "./_components/features"
import { DashboardPreview } from "./_components/dashboard-preview"
import { HowItWorks } from "./_components/how-it-works"
import { SocialProof } from "./_components/social-proof"
import { WhoItsFor } from "./_components/who-its-for"
import { FAQ } from "./_components/faq"
import { GetStarted } from "./_components/get-started"
import { Footer } from "./_components/footer"
import { CookieConsent } from "@/components/blocks/cookie-consent"

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <Features />
      <DashboardPreview />
      <HowItWorks />
      <SocialProof />
      <WhoItsFor />
      <FAQ />
      <GetStarted />
      <Footer />
      <CookieConsent
        cardClassName="bg-brand-white"
        acceptButtonClassName="bg-brand-black text-brand-white"
        declineButtonClassName="border border-brand-black/20 text-brand-black"
        variant="small"
        className="sm:left-auto sm:right-4"
      />
    </main>
  )
}
