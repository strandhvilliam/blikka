"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"
import { motion } from "motion/react"

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#gallery", label: "Gallery" },
  { href: "#pricing", label: "Pricing" },
] as const

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav className="absolute top-3 left-3 right-3 z-50 flex items-center justify-between rounded-t-2xl px-6 py-5 lg:top-4 lg:left-4 lg:right-4 lg:rounded-t-3xl lg:px-12">
      <div className="flex items-center gap-12">
        <Link href="/" className="flex items-center animate-hero-fade-in-from-top" aria-label="blikka home">
          <img
            src="/blikka-logo-white.svg"
            alt="blikka logo"
            width={36}
            height={30}
            className="h-7 w-auto lg:h-8"
          />
        </Link>

        <motion.div
          className="hidden items-center gap-10 md:flex"
          initial="hidden"
          animate="visible"
          variants={{
            visible: {
              transition: {
                staggerChildren: 0.05,
                delayChildren: 0.08,
              },
            },
            hidden: {},
          }}
        >
          {navLinks.map((link) => (
            <motion.div
              key={link.href}
              variants={{
                hidden: { opacity: 0, y: 6 },
                visible: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              whileHover={{ y: -2, transition: { duration: 0.2 } }}
              whileTap={{ scale: 0.98 }}
            >
              <Link
                href={link.href}
                className="block text-sm text-brand-white transition-colors hover:text-white"
              >
                {link.label}
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>

      <div className="hidden items-center gap-4 md:flex animate-hero-fade-in-from-top [animation-delay:120ms]">
        <Link href="#" className="text-sm text-white/80 transition-colors hover:text-white">
          Log in
        </Link>
        <Link
          href="#pricing"
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
        <motion.div
          className="absolute top-full left-0 right-0 flex flex-col gap-4 bg-brand-black/95 px-6 py-8 backdrop-blur-xl md:hidden"
          initial="hidden"
          animate="visible"
          variants={{
            visible: {
              transition: {
                staggerChildren: 0.04,
                delayChildren: 0.05,
              },
            },
            hidden: {},
          }}
        >
          {navLinks.map((link) => (
            <motion.div
              key={link.href}
              variants={{
                hidden: { opacity: 0, x: -8 },
                visible: { opacity: 1, x: 0 },
              }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <Link
                href={link.href}
                className="block text-sm text-white/80 transition-colors hover:text-white"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            </motion.div>
          ))}
          <hr className="border-white/10" />
          <Link href="#" className="text-sm text-white/80">
            Log in
          </Link>
          <Link
            href="#pricing"
            className="rounded-full border border-white/30 bg-white/10 px-5 py-2 text-center text-sm text-white"
          >
            Get started
          </Link>
        </motion.div>
      )}
    </nav>
  )
}
