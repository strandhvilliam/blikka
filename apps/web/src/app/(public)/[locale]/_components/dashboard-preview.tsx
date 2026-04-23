"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronsUpDown,
  Clock,
  Filter,
  Hash,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  Scale,
  Search,
  Settings,
  Shield,
  Upload,
  Users,
  Users2,
} from "lucide-react"
import { FadeIn } from "./fade-in"
import { NoiseOverlay } from "./noise-overlay"

/* ----------------------------- data ----------------------------- */

type Status = "Completed" | "Verified" | "Uploading" | "Errors" | "Prepared"

type Row = {
  ref: string
  name: string
  email: string
  when: string
  status: Status
  done: number
  total: number
  className: string
  device: "Mobile" | "Digital Camera"
  checks: number
  warns: number
}

const SEED: Row[] = [
  {
    ref: "1030",
    name: "Ludvig Larsson",
    email: "ludvig.larsson@example.com",
    when: "Mar 15, 08:18 PM",
    status: "Verified",
    done: 24,
    total: 24,
    className: "24 Images",
    device: "Mobile",
    checks: 73,
    warns: 0,
  },
  {
    ref: "1029",
    name: "Elin Lindqvist",
    email: "elin.lindqvist@example.com",
    when: "Mar 15, 08:18 PM",
    status: "Verified",
    done: 8,
    total: 8,
    className: "8 Images",
    device: "Digital Camera",
    checks: 25,
    warns: 0,
  },
  {
    ref: "1028",
    name: "Viktor Bergström",
    email: "viktor.bergstrom@example.com",
    when: "Mar 15, 08:18 PM",
    status: "Verified",
    done: 24,
    total: 24,
    className: "24 Images",
    device: "Digital Camera",
    checks: 73,
    warns: 0,
  },
  {
    ref: "1027",
    name: "Maja Eklund",
    email: "maja.eklund@example.se",
    when: "Mar 15, 08:18 PM",
    status: "Errors",
    done: 8,
    total: 8,
    className: "8 Images",
    device: "Mobile",
    checks: 22,
    warns: 3,
  },
  {
    ref: "1026",
    name: "Cecilia Holm",
    email: "cecilia.holm@example.com",
    when: "Mar 15, 08:18 PM",
    status: "Verified",
    done: 24,
    total: 24,
    className: "24 Images",
    device: "Mobile",
    checks: 73,
    warns: 0,
  },
  {
    ref: "1025",
    name: "Anders Wallin",
    email: "anders.wallin@example.com",
    when: "Mar 15, 08:17 PM",
    status: "Verified",
    done: 8,
    total: 8,
    className: "8 Images",
    device: "Digital Camera",
    checks: 25,
    warns: 0,
  },
  {
    ref: "1024",
    name: "Jonas Lundberg",
    email: "jonas.lundberg@example.com",
    when: "Mar 15, 08:17 PM",
    status: "Verified",
    done: 24,
    total: 24,
    className: "24 Images",
    device: "Digital Camera",
    checks: 72,
    warns: 1,
  },
  {
    ref: "1023",
    name: "Simon Nyström",
    email: "simon.nystrom@example.com",
    when: "Mar 15, 08:17 PM",
    status: "Verified",
    done: 8,
    total: 8,
    className: "8 Images",
    device: "Digital Camera",
    checks: 25,
    warns: 0,
  },
  {
    ref: "1022",
    name: "Alma Hedlund",
    email: "alma.hedlund@example.com",
    when: "Mar 15, 08:17 PM",
    status: "Verified",
    done: 24,
    total: 24,
    className: "24 Images",
    device: "Mobile",
    checks: 73,
    warns: 0,
  },
  {
    ref: "1021",
    name: "Janne Sjögren",
    email: "janne.sjogren@example.com",
    when: "Mar 15, 08:17 PM",
    status: "Verified",
    done: 8,
    total: 8,
    className: "8 Images",
    device: "Mobile",
    checks: 25,
    warns: 0,
  },
  {
    ref: "1020",
    name: "Frida Åberg",
    email: "frida.aberg@example.com",
    when: "Mar 15, 08:16 PM",
    status: "Verified",
    done: 24,
    total: 24,
    className: "24 Images",
    device: "Mobile",
    checks: 72,
    warns: 1,
  },
  {
    ref: "1019",
    name: "Oscar Dahl",
    email: "oscar.dahl@example.com",
    when: "Mar 15, 08:16 PM",
    status: "Verified",
    done: 8,
    total: 8,
    className: "8 Images",
    device: "Digital Camera",
    checks: 25,
    warns: 0,
  },
]

const TABS: { id: "all" | Status; label: string; match: (r: Row) => boolean }[] = [
  { id: "all", label: "All", match: () => true },
  { id: "Prepared", label: "Prepared", match: (r) => r.status === "Prepared" },
  { id: "Uploading", label: "Uploading", match: (r) => r.status === "Uploading" },
  {
    id: "Verified",
    label: "Verified",
    match: (r) => r.status === "Verified" || r.status === "Completed",
  },
  { id: "Errors", label: "Errors", match: (r) => r.status === "Errors" },
]

/* --------------------------- helpers --------------------------- */

const STATUS_STYLES: Record<Status, string> = {
  Completed: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
  Verified: "bg-sky-400/10 text-sky-300 ring-sky-400/20",
  Uploading: "bg-amber-300/10 text-amber-200 ring-amber-300/25",
  Errors: "bg-rose-500/10 text-rose-300 ring-rose-500/25",
  Prepared: "bg-white/5 text-white/70 ring-white/10",
}

function StatusPill({ status }: { status: Status }) {
  const Icon =
    status === "Completed"
      ? CheckCircle2
      : status === "Verified"
        ? CheckCircle2
        : status === "Errors"
          ? AlertTriangle
          : status === "Uploading"
            ? Loader2
            : Clock
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      <Icon className={`h-3 w-3 ${status === "Uploading" ? "animate-spin" : ""}`} aria-hidden />
      {status}
    </span>
  )
}

/* ------------------------- desktop frame ------------------------- */

function DesktopDashboard() {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["id"]>("all")
  const [query, setQuery] = useState("")
  const [rows, setRows] = useState<Row[]>(SEED)
  const [liveRef, setLiveRef] = useState<string | null>(null)
  const [hoverRef, setHoverRef] = useState<string | null>(null)
  const [spot, setSpot] = useState({ x: 50, y: 20 })
  const containerRef = useRef<HTMLDivElement>(null)

  /* idle auto-demo: promote a row into "Uploading", tick progress, flip status */
  useEffect(() => {
    if (typeof window === "undefined") return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduced) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    const pickLive = () => {
      setRows((prev) => {
        const idx = Math.floor(Math.random() * Math.min(4, prev.length))
        const target = prev[idx]
        if (!target) return prev
        setLiveRef(target.ref)
        const next = [...prev]
        next[idx] = { ...target, status: "Uploading", done: 0, total: target.total }
        return next
      })
    }

    const tick = () => {
      if (cancelled) return
      setRows((prev) =>
        prev.map((r) => {
          if (r.status !== "Uploading") return r
          const done = Math.min(r.total, r.done + Math.max(1, Math.round(r.total / 12)))
          if (done >= r.total) {
            return { ...r, done, status: "Verified" }
          }
          return { ...r, done }
        }),
      )
      timer = setTimeout(tick, 380)
    }

    const loop = () => {
      if (cancelled) return
      pickLive()
      timer = setTimeout(tick, 400)
      setTimeout(() => {
        if (cancelled) return
        setLiveRef(null)
        timer = setTimeout(loop, 3200)
      }, 5200)
    }

    const start = setTimeout(loop, 1400)
    return () => {
      cancelled = true
      clearTimeout(start)
      clearTimeout(timer)
    }
  }, [])

  const filtered = useMemo(() => {
    const tab = TABS.find((t) => t.id === activeTab)!
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (!tab.match(r)) return false
      if (!q) return true
      return (
        r.ref.includes(q) || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)
      )
    })
  }, [rows, activeTab, query])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length }
    for (const t of TABS) if (t.id !== "all") c[t.id] = rows.filter(t.match).length
    return c
  }, [rows])

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setSpot({
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
    })
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setSpot({ x: 50, y: 20 })}
      className="group/dash relative overflow-hidden rounded-xl border border-white/10 bg-[#0c0c0d] text-white/90 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.6)] lg:rounded-2xl"
    >
      {/* cursor spotlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70 transition-opacity duration-300 group-hover/dash:opacity-100"
        style={{
          background: `radial-gradient(400px circle at ${spot.x}% ${spot.y}%, color-mix(in oklch, var(--brand-primary) 22%, transparent), transparent 60%)`,
        }}
      />
      {/* faint grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse 70% 50% at 50% 0%, black, transparent 70%)",
        }}
      />

      {/* top bar */}
      <div className="relative flex items-center justify-between border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-7 items-center rounded-md bg-white/5 px-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/blikka-logo-white.svg"
              alt="blikka"
              width={48}
              height={16}
              className="h-4 w-auto"
            />
          </div>
          <div className="hidden items-center gap-2 rounded-md bg-white/[0.04] px-2.5 py-1 text-[12px] ring-1 ring-inset ring-white/5 md:inline-flex">
            <Hash className="h-3.5 w-3.5 text-white/50" aria-hidden />
            <span className="font-medium">Uppsala Fotomaraton</span>
            <span className="text-white/40">·</span>
            <span className="text-white/50">12 March 2026</span>
            <ChevronsUpDown className="h-3.5 w-3.5 text-white/40" aria-hidden />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="relative hidden items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300 ring-1 ring-inset ring-emerald-400/20 md:inline-flex">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            LIVE
          </span>
          <button className="inline-flex items-center gap-1.5 rounded-md bg-white/5 px-2.5 py-1 text-[11px] text-white/70 ring-1 ring-inset ring-white/5 transition hover:bg-white/10">
            <Users className="h-3.5 w-3.5" aria-hidden /> Staff
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-md bg-white/5 px-2.5 py-1 text-[11px] text-white/70 ring-1 ring-inset ring-white/5 transition hover:bg-white/10">
            <Upload className="h-3.5 w-3.5" aria-hidden /> Upload
          </button>
        </div>
      </div>

      <div className="relative grid min-h-[520px] grid-cols-[180px_1fr] xl:min-h-[600px] xl:grid-cols-[210px_1fr] 2xl:min-h-[660px] 2xl:grid-cols-[230px_1fr]">
        {/* sidebar */}
        <aside className="border-r border-white/5 p-3 text-[12px]">
          <p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-widest text-white/40">
            Marathon
          </p>
          <SideLink icon={LayoutDashboard} label="Dashboard" />
          <SideLink icon={Camera} label="Submissions" active badge={rows.length.toString()} />
          <SideLink icon={Upload} label="Export" />
          <SideLink icon={Users2} label="Staff" />
          <SideLink icon={Scale} label="Jury" />
          <p className="mt-4 px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/40">
            Configuration
          </p>
          <SideLink icon={Shield} label="Rules" />
          <SideLink icon={Settings} label="Settings" />
        </aside>

        {/* main */}
        <div className="relative p-4 xl:p-5 2xl:p-6">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h3 className="font-gothic text-xl leading-tight tracking-tight md:text-2xl xl:text-[1.7rem]">
                Submissions
              </h3>
              <p className="text-[12px] text-white/50 xl:text-[13px]">
                View and manage photo submissions from participants
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button className="inline-flex items-center gap-1.5 rounded-md bg-white/5 px-2.5 py-1 text-[11px] text-white/70 ring-1 ring-inset ring-white/5 transition hover:bg-white/10">
                <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Refresh
              </button>
              <button className="inline-flex items-center gap-1.5 rounded-md bg-brand-primary px-2.5 py-1 text-[11px] font-semibold text-brand-black shadow-[0_6px_20px_-6px_color-mix(in_oklch,var(--brand-primary)_60%,transparent)] transition hover:brightness-110">
                <Upload className="h-3.5 w-3.5" aria-hidden /> Manual Upload
              </button>
            </div>
          </div>

          {/* tabs */}
          <div className="relative mb-3 flex items-center gap-5 border-b border-white/5 text-[12px]">
            {TABS.map((t) => {
              const active = t.id === activeTab
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`relative -mb-px border-b-2 px-0.5 pb-2 pt-0.5 transition ${
                    active
                      ? "border-brand-primary text-white"
                      : "border-transparent text-white/50 hover:text-white/80"
                  }`}
                >
                  {t.label}
                  <span className="ml-1.5 rounded-full bg-white/5 px-1.5 text-[10px] text-white/60">
                    {counts[t.id] ?? 0}
                  </span>
                </button>
              )
            })}
          </div>

          {/* search + filters */}
          <div className="mb-2 flex items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-md bg-white/[0.04] px-2.5 py-1.5 ring-1 ring-inset ring-white/5 focus-within:ring-brand-primary/50">
              <Search className="h-3.5 w-3.5 text-white/40" aria-hidden />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by reference, name, or email…"
                className="w-full bg-transparent text-[12px] outline-none placeholder:text-white/35"
              />
            </div>
            <button className="inline-flex items-center gap-1.5 rounded-md bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-white/70 ring-1 ring-inset ring-white/5">
              <Filter className="h-3.5 w-3.5" aria-hidden /> Newest first
            </button>
          </div>

          {/* table */}
          <div className="relative overflow-hidden rounded-md ring-1 ring-inset ring-white/5">
            <div className="grid grid-cols-[64px_1.3fr_120px_120px_1fr_96px] gap-x-4 border-b border-white/5 bg-white/[0.03] px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-white/45 xl:px-4 xl:py-2.5 xl:text-[10.5px]">
              <span>Ref.</span>
              <span>Participant</span>
              <span>Status</span>
              <span>Upload</span>
              <span>Class</span>
              <span className="text-right">Checks</span>
            </div>
            <div className="max-h-[340px] overflow-hidden xl:max-h-[440px] 2xl:max-h-[500px]">
              {filtered.length === 0 && (
                <div className="flex h-24 items-center justify-center text-[12px] text-white/40">
                  No submissions match your filter.
                </div>
              )}
              {filtered.map((r) => {
                const pct = Math.round((r.done / r.total) * 100)
                const isLive = liveRef === r.ref || r.status === "Uploading"
                const isHover = hoverRef === r.ref
                return (
                  <div
                    key={r.ref}
                    onMouseEnter={() => setHoverRef(r.ref)}
                    onMouseLeave={() => setHoverRef(null)}
                    className={`group/row relative grid grid-cols-[64px_1.3fr_120px_120px_1fr_96px] items-center gap-x-4 border-b border-white/[0.04] px-3 py-2 text-[12px] transition xl:px-4 xl:py-2.5 xl:text-[12.5px] ${
                      isHover ? "bg-white/[0.05]" : "bg-transparent"
                    } ${isLive ? "bg-brand-primary/[0.06]" : ""}`}
                  >
                    {isLive && (
                      <span className="absolute left-0 top-0 h-full w-[2px] bg-brand-primary" />
                    )}
                    <span className="font-mono text-white/70">{r.ref}</span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium text-white/90">{r.name}</span>
                      <span className="truncate text-[10.5px] text-white/40">{r.email}</span>
                    </span>
                    <StatusPill status={r.status} />
                    <span className="flex items-center gap-2">
                      <span className="relative h-1 w-12 overflow-hidden rounded-full bg-white/10">
                        <span
                          className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 ${
                            r.status === "Errors"
                              ? "bg-rose-400"
                              : r.status === "Uploading"
                                ? "bg-brand-primary"
                                : "bg-emerald-400"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                      <span className="tabular-nums text-white/60">
                        {r.done}/{r.total}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/30" />
                      <span className="truncate text-white/70">{r.className}</span>
                      <span className="hidden text-white/30 xl:inline">·</span>
                      <span className="hidden truncate text-white/40 xl:inline">{r.device}</span>
                    </span>
                    <span className="flex items-center justify-end gap-1.5">
                      {r.warns > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-medium text-rose-300 ring-1 ring-inset ring-rose-500/20">
                          <AlertTriangle className="h-3 w-3" aria-hidden />
                          {r.warns}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-white/60 ring-1 ring-inset ring-white/10">
                        <CheckCircle2 className="h-3 w-3 text-emerald-400" aria-hidden />
                        {r.checks}
                      </span>
                    </span>

                    {/* hover tooltip */}
                    <div
                      className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 translate-x-2 rounded-md border border-white/10 bg-[#0c0c0d]/95 px-2 py-1 text-[10.5px] font-medium text-white/80 shadow-lg backdrop-blur transition-all duration-150 ${
                        isHover ? "translate-x-0 opacity-100" : "opacity-0"
                      }`}
                    >
                      View submission →
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SideLink({
  icon: Icon,
  label,
  active,
  badge,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
  label: string
  active?: boolean
  badge?: string
}) {
  return (
    <button
      className={`mb-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition ${
        active
          ? "bg-brand-primary/10 text-white ring-1 ring-inset ring-brand-primary/20"
          : "text-white/60 hover:bg-white/[0.04] hover:text-white/90"
      }`}
    >
      <Icon className={`h-3.5 w-3.5 ${active ? "text-brand-primary" : ""}`} aria-hidden />
      <span className="flex-1 truncate text-[12px]">{label}</span>
      {badge && (
        <span className="rounded-full bg-white/10 px-1.5 text-[10px] text-white/70">{badge}</span>
      )}
    </button>
  )
}

/* -------------------------- mobile frame -------------------------- */

function MobileDashboard() {
  const [progress, setProgress] = useState(18)
  const [flipped, setFlipped] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduced) return
    const i = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          setFlipped(true)
          setTimeout(() => {
            setFlipped(false)
            setProgress(12)
          }, 1800)
          return 100
        }
        return Math.min(100, p + 6)
      })
    }, 420)
    return () => clearInterval(i)
  }, [])

  return (
    <div className="relative mx-auto w-full max-w-[320px]">
      {/* device frame */}
      <div className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[#0c0c0d] p-2 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.7)]">
        <div className="relative overflow-hidden rounded-[1.75rem] border border-white/5 bg-[#0a0a0b]">
          {/* notch */}
          <div className="pointer-events-none absolute left-1/2 top-0 z-10 h-5 w-24 -translate-x-1/2 rounded-b-2xl bg-black/90" />

          {/* top */}
          <div className="px-4 pb-3 pt-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-widest text-white/40">
                  Uppsala Fotomaraton
                </p>
                <h4 className="font-gothic mt-0.5 text-lg leading-tight text-white">Submissions</h4>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300 ring-1 ring-inset ring-emerald-400/20">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                LIVE
              </span>
            </div>

            {/* stat row */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              <MobileStat label="Total" value="1,032" />
              <MobileStat label="Verified" value="978" tone="ok" />
              <MobileStat label="Errors" value="4" tone="warn" />
            </div>

            {/* cards */}
            <div className="mt-3 space-y-2">
              {/* live card */}
              <div className="relative overflow-hidden rounded-xl border border-brand-primary/25 bg-brand-primary/[0.06] p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/70">
                      #1031
                    </span>
                    <span className="text-[12px] font-medium text-white">Ingrid Larsson</span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset transition ${
                      flipped
                        ? "bg-sky-400/10 text-sky-300 ring-sky-400/20"
                        : "bg-amber-300/10 text-amber-200 ring-amber-300/25"
                    }`}
                  >
                    {flipped ? (
                      <CheckCircle2 className="h-3 w-3" aria-hidden />
                    ) : (
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    )}
                    {flipped ? "Verified" : "Uploading"}
                  </span>
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <span className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full bg-brand-primary transition-[width] duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </span>
                  <span className="tabular-nums text-[10.5px] text-white/60">
                    {Math.round((progress / 100) * 24)}/24
                  </span>
                </div>
              </div>

              <MobileCard ref_="1030" name="Ludvig Larsson" status="Verified" count="24/24" />
              <MobileCard ref_="1029" name="Elin Larsson" status="Verified" count="8/8" />
              <MobileCard ref_="1017" name="Maja Karlsson" status="Errors" count="7/8" />
            </div>
          </div>

          {/* bottom tab bar */}
          <div className="sticky bottom-0 grid grid-cols-4 border-t border-white/5 bg-[#0a0a0b]/95 px-2 py-2 backdrop-blur">
            {[
              { icon: LayoutDashboard, label: "Home" },
              { icon: Camera, label: "Entries", active: true },
              { icon: Users2, label: "Staff" },
              { icon: Settings, label: "More" },
            ].map((t) => (
              <button
                key={t.label}
                className={`flex flex-col items-center gap-0.5 rounded-md py-1 text-[9.5px] ${
                  t.active ? "text-brand-primary" : "text-white/45"
                }`}
              >
                <t.icon className="h-4 w-4" aria-hidden />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {/* ambient glow */}
      <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[3rem] bg-[radial-gradient(ellipse_at_center,color-mix(in_oklch,var(--brand-primary)_18%,transparent),transparent_70%)] blur-2xl" />
    </div>
  )
}

function MobileStat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: "ok" | "warn"
}) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.03] p-2">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-white/40">{label}</p>
      <p
        className={`font-gothic mt-0.5 text-base leading-none tabular-nums ${
          tone === "warn" ? "text-rose-300" : tone === "ok" ? "text-emerald-300" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  )
}

function MobileCard({
  ref_,
  name,
  status,
  count,
}: {
  ref_: string
  name: string
  status: Status
  count: string
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
      <div className="flex items-center gap-2">
        <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/60">
          #{ref_}
        </span>
        <div>
          <p className="text-[12px] font-medium text-white/90 leading-tight">{name}</p>
          <p className="text-[10px] text-white/40 leading-tight">{count} images</p>
        </div>
      </div>
      <StatusPill status={status} />
    </div>
  )
}

/* ---------------------------- section ---------------------------- */

const badges = [
  { icon: Camera, label: "Real-time uploads" },
  { icon: Users, label: "Judge management" },
  { icon: Shield, label: "Submission validation" },
]

export function DashboardPreview() {
  return (
    <section className="px-3 pb-6 lg:px-4 lg:pb-8">
      <div className="relative overflow-hidden rounded-2xl bg-brand-black px-6 py-16 md:px-10 md:py-20 lg:rounded-3xl lg:px-12 lg:py-24">
        <NoiseOverlay opacity={0.05} />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,color-mix(in_oklch,var(--brand-primary)_18%,transparent),transparent)]" />

        <div className="relative mx-auto max-w-6xl xl:max-w-7xl 2xl:max-w-[88rem]">
          <FadeIn>
            <div className="mb-10 text-center lg:mb-14">
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-brand-primary">
                Your Command Center
              </p>
              <h2 className="font-gothic mx-auto max-w-3xl text-balance text-3xl leading-snug font-normal tracking-tight text-brand-white md:text-4xl lg:text-[2.85rem] lg:leading-[1.15]">
                Everything happening at your event, visible in one dashboard
              </h2>
            </div>
          </FadeIn>

          <FadeIn delay={120}>
            <div className="relative">
              {/* desktop */}
              <div className="hidden lg:block">
                <DesktopDashboard />
              </div>
              {/* mobile */}
              <div className="lg:hidden">
                <MobileDashboard />
              </div>
              <div className="pointer-events-none absolute -bottom-8 left-1/2 h-32 w-3/4 -translate-x-1/2 rounded-full bg-brand-primary/10 blur-3xl" />
            </div>
          </FadeIn>

          <FadeIn delay={240}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-2.5 md:gap-3 lg:mt-14">
              {badges.map((badge) => {
                const Icon = badge.icon
                return (
                  <span
                    key={badge.label}
                    className="inline-flex items-center gap-2 rounded-full border border-brand-white/10 bg-brand-white/5 px-3 py-2 text-xs text-brand-white/80 backdrop-blur-sm md:gap-2.5 md:px-4 md:py-2.5 md:text-sm"
                  >
                    <Icon className="h-4 w-4 text-brand-primary" aria-hidden="true" />
                    {badge.label}
                  </span>
                )
              })}
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  )
}
