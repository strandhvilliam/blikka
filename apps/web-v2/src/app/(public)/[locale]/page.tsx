import { Navbar } from "./_components/navbar"
import { Hero } from "./_components/hero"
import { Stats } from "./_components/stats"
import { LogoStrip } from "./_components/logo-strip"
import { Features } from "./_components/features"
import { HowItWorks } from "./_components/how-it-works"
import { Gallery } from "./_components/gallery"
import { SocialProof } from "./_components/social-proof"
import { Pricing } from "./_components/pricing"
import { CTA } from "./_components/cta"
import { Footer } from "./_components/footer"

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
      <Pricing />
      <CTA />
      <Footer />
    </main>
  )
}
