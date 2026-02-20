"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav className="absolute top-3 left-3 right-3 z-50 flex items-center justify-between rounded-t-2xl px-6 py-5 lg:top-4 lg:left-4 lg:right-4 lg:rounded-t-3xl lg:px-12">
      <Link href="/" className="flex items-center animate-hero-fade-in-from-top" aria-label="blikka home">
        <img
          src="/blikka-logo-white.svg"
          alt="blikka logo"
          width={36}
          height={30}
          className="h-7 w-auto lg:h-8"
        />
      </Link>

      <div className="hidden items-center gap-8 md:flex animate-hero-fade-in-from-top [animation-delay:80ms]">
        <Link href="#features" className="text-sm text-white/80 transition-colors hover:text-white">
          Features
        </Link>
        <Link href="#how-it-works" className="text-sm text-white/80 transition-colors hover:text-white">
          How it works
        </Link>
        <Link href="#gallery" className="text-sm text-white/80 transition-colors hover:text-white">
          Gallery
        </Link>
        <Link href="#pricing" className="text-sm text-white/80 transition-colors hover:text-white">
          Pricing
        </Link>
      </div>

      <div className="hidden items-center gap-4 md:flex animate-hero-fade-in-from-top [animation-delay:120ms]">
        <Link href="#" className="text-sm text-white/80 transition-colors hover:text-white">
          Log in
        </Link>
        <Link
          href="#"
          className="rounded-full border border-white/30 bg-white/10 px-5 py-2 text-sm text-white backdrop-blur-sm transition-all hover:bg-white hover:text-foreground"
        >
          Get started
        </Link>
      </div>

      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="text-white md:hidden animate-hero-fade-in-from-top [animation-delay:80ms]"
        aria-label="Toggle menu"
      >
        {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {mobileOpen && (
        <div className="absolute top-full left-0 right-0 flex flex-col gap-4 bg-brand-black/95 px-6 py-8 backdrop-blur-xl md:hidden">
          <Link href="#features" className="text-sm text-white/80" onClick={() => setMobileOpen(false)}>
            Features
          </Link>
          <Link href="#how-it-works" className="text-sm text-white/80" onClick={() => setMobileOpen(false)}>
            How it works
          </Link>
          <Link href="#gallery" className="text-sm text-white/80" onClick={() => setMobileOpen(false)}>
            Gallery
          </Link>
          <Link href="#pricing" className="text-sm text-white/80" onClick={() => setMobileOpen(false)}>
            Pricing
          </Link>
          <hr className="border-white/10" />
          <Link href="#" className="text-sm text-white/80">
            Log in
          </Link>
          <Link
            href="#"
            className="rounded-full border border-white/30 bg-white/10 px-5 py-2 text-center text-sm text-white"
          >
            Get started
          </Link>
        </div>
      )}
    </nav>
  )
}
