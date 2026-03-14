"use client"

import Link from "next/link"
import { FadeIn } from "./fade-in"

const footerLinks = {
  Product: [
    { label: "Features", href: "#features" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "Who It's For", href: "#who-its-for" },
    { label: "FAQ", href: "#faq" },
    { label: "Pricing", href: "#pricing" },
  ],
  Contact: [
    { label: "hello@blikka.app", href: "mailto:hello@blikka.app" },
    { label: "Book A Demo", href: "#pricing" },
  ],
}

const socialLinks = [
  { label: "Twitter", href: "https://x.com/villiamstrandh" },
  { label: "Instagram", href: "https://www.instagram.com/stockholmfotomaraton" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/villiam-strandh/" },
]

export function Footer() {
  return (
    <footer className="border-t border-border bg-background px-6 py-12 md:px-10 lg:px-12 lg:py-14">
      <div className="mx-auto max-w-6xl">
        <FadeIn>
            <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-[1fr_auto_auto]">
            <div className="max-w-xs">
              <Link href="/" className="inline-block" aria-label="blikka home">
                <img
                  src="/blikka-logo-dark.svg"
                  alt="blikka logo"
                  width={36}
                  height={30}
                  className="h-7 w-auto"
                />
              </Link>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Blikka helps organizers run upload, judging, and showcase workflows for photo
                events without the usual operational mess.
              </p>
            </div>

            {Object.entries(footerLinks).map(([category, links]) => (
              <div key={category}>
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-foreground">
                  {category}
                </p>
                <ul className="flex flex-col gap-2.5">
                  {links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 sm:flex-row">
            <p className="text-xs text-muted-foreground">
              {`© ${new Date().getFullYear()} Villiam Strandh & Fotomaraton Sverige AB`}
            </p>
            <div className="flex gap-6">
              {socialLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>
    </footer>
  )
}
