'use client'

import { FileText } from 'lucide-react'

export function TermsHeader() {
  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary/10">
          <FileText className="h-[18px] w-[18px] text-brand-primary" strokeWidth={1.8} />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            Legal
          </p>
          <h1 className="font-gothic text-2xl font-bold leading-none tracking-tight">
            Terms & Conditions
          </h1>
        </div>
      </div>
      <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
        Manage the terms and conditions participants must accept before joining your marathon.
      </p>
    </div>
  )
}
