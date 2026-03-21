"use client"

import { Settings } from "lucide-react"

export function SettingsHeader() {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary/10">
          <Settings className="h-[18px] w-[18px] text-brand-primary" strokeWidth={1.8} />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            Configuration
          </p>
          <h1 className="text-2xl font-bold tracking-tight font-gothic leading-none">Settings</h1>
        </div>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
        Configure your marathon name, schedule, languages, terms, and branding.
      </p>
    </div>
  )
}
