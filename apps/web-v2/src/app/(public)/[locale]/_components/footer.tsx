"use client"

import Link from "next/link"
import { FadeIn } from "./fade-in"

const footerLinks = {
  Product: [
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "#pricing" },
    { label: "How it works", href: "#how-it-works" },
    { label: "Gallery", href: "#gallery" },
  ],
  Company: [
    { label: "About", href: "#" },
    { label: "Blog", href: "#" },
    { label: "Careers", href: "#" },
    { label: "Contact", href: "#" },
  ],
  Legal: [
    { label: "Privacy", href: "#" },
    { label: "Terms", href: "#" },
    { label: "Cookie Policy", href: "#" },
  ],
}

export function Footer() {
  return (
    <footer className="border-t border-border bg-background px-6 py-16 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <FadeIn>
          <div className="flex flex-col gap-12 lg:flex-row lg:justify-between">
            {/* Brand */}
            <div className="max-w-xs">
              <Link href="/" className="flex items-center" aria-label="blikka home">
                <img
                  src="/blikka-logo-dark.svg"
                  alt="blikka logo"
                  width={36}
                  height={30}
                  className="h-7 w-auto"
                />
              </Link>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                The simplest way to collect and showcase photo competition entries.
                Made for creators, by creators.
              </p>
            </div>

            {/* Link columns */}
            <div className="grid grid-cols-3 gap-8">
              {Object.entries(footerLinks).map(([category, links]) => (
                <div key={category}>
                  <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-foreground">
                    {category}
                  </p>
                  <ul className="flex flex-col gap-3">
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
          </div>

          {/* Bottom bar */}
          <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 sm:flex-row">
            <p className="text-xs text-muted-foreground">
              {`© ${new Date().getFullYear()} blikka. All rights reserved.`}
            </p>
            <div className="flex gap-6">
              <Link href="#" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
                Twitter
              </Link>
              <Link href="#" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
                Instagram
              </Link>
              <Link href="#" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
                LinkedIn
              </Link>
            </div>
          </div>
        </FadeIn>
      </div>
    </footer>
  )
}
