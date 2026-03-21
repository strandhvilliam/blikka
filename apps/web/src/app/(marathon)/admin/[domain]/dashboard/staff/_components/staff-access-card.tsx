"use client"

import { useState } from "react"
import { Copy, ExternalLink, ShieldCheck, LogIn } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { formatDomainLink } from "@/lib/utils"
import { useDomain } from "@/lib/domain-provider"

export function StaffAccessCard() {
  const domain = useDomain()
  const [isCopying, setIsCopying] = useState(false)
  const staffUrl = formatDomainLink("/staff", domain, "staff")

  const handleCopy = async () => {
    try {
      setIsCopying(true)
      await navigator.clipboard.writeText(staffUrl)
      toast.success("Staff link copied")
    } catch (error) {
      console.error(error)
      toast.error("Failed to copy staff link")
    } finally {
      setIsCopying(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-white p-4 transition-shadow duration-200 hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.04)]">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary/10">
          <ShieldCheck className="h-4 w-4 text-brand-primary" strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1 space-y-2.5">
          <div>
            <h3 className="text-[13px] font-semibold">Staff desk access</h3>
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
              Staff now work from a separate verification page. Share this link and tell them to
              sign in with the email address you added here.
            </p>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
            <p className="truncate font-mono text-[11px] text-muted-foreground">{staffUrl}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="h-8 gap-1.5 px-3 text-xs" asChild>
              <a href={staffUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Open staff page
              </a>
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1.5 px-3 text-xs" onClick={() => void handleCopy()}>
              <Copy className="h-3.5 w-3.5" />
              {isCopying ? "Copying..." : "Copy link"}
            </Button>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
            <LogIn className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>Staff use the shared email OTP login flow. No separate password setup is needed.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
