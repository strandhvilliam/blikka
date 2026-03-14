"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#who-its-for", label: "Who It's For" },
  { href: "#faq", label: "FAQ" },
  { href: "#pricing", label: "Pricing" },
] as const

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [mobileOpen])

  return (
    <>
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
            className="hidden items-center gap-8 lg:flex lg:gap-10"
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
                  className="block text-sm text-brand-white transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black/50"
                >
                  {link.label}
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>

        <div className="hidden items-center gap-4 lg:flex animate-hero-fade-in-from-top [animation-delay:120ms]">
          <Link
            href="#pricing"
            className="rounded-full border border-white/30 bg-white/10 px-5 py-2 text-sm text-white backdrop-blur-sm transition-[background-color,color,border-color] hover:bg-white hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black/50"
          >
            Get Started
          </Link>
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="relative z-70 text-white lg:hidden animate-hero-fade-in-from-top [animation-delay:80ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black/50"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 z-60 flex flex-col overscroll-contain bg-white/80 backdrop-blur-2xl lg:hidden"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          >
            <div className="flex items-center justify-between px-6 py-5">
              <Link href="/" onClick={() => setMobileOpen(false)} aria-label="blikka home">
                <img
                  src="/blikka-logo-dark.svg"
                  alt="blikka logo"
                  width={36}
                  height={30}
                  className="h-7 w-auto"
                />
              </Link>
              <button
                onClick={() => setMobileOpen(false)}
                className="text-brand-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/80 focus-visible:ring-offset-2"
                aria-label="Close menu"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="flex flex-1 flex-col justify-center px-8">
              <motion.div
                className="flex flex-col gap-1"
                initial="hidden"
                animate="visible"
                variants={{
                  visible: {
                    transition: {
                      staggerChildren: 0.06,
                      delayChildren: 0.1,
                    },
                  },
                  hidden: {},
                }}
              >
                {navLinks.map((link) => (
                  <motion.div
                    key={link.href}
                    variants={{
                      hidden: { opacity: 0, y: 20 },
                      visible: { opacity: 1, y: 0 },
                    }}
                    transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                  >
                    <Link
                      href={link.href}
                      className="block py-4 text-4xl font-semibold tracking-tight text-brand-black transition-colors hover:text-brand-black/40"
                      onClick={() => setMobileOpen(false)}
                    >
                      {link.label}
                    </Link>
                  </motion.div>
                ))}
              </motion.div>
            </div>

            <motion.div
              className="flex flex-col gap-3 border-t border-black/10 px-8 py-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35, duration: 0.3 }}
            >
              <Link
                href="#pricing"
                className="rounded-full bg-brand-primary px-6 py-3.5 text-center text-base font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/80 focus-visible:ring-offset-2"
                onClick={() => setMobileOpen(false)}
              >
                Get Started
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
