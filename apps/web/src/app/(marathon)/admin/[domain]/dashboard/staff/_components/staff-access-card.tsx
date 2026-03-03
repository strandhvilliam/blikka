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
    <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <h3 className="font-medium">Staff desk access</h3>
            <p className="text-sm text-muted-foreground">
              Staff now work from a separate verification page. Share this link and tell them to
              sign in with the email address you added here.
            </p>
          </div>
          <div className="rounded-xl border bg-background px-3 py-2">
            <p className="truncate font-mono text-xs text-muted-foreground">{staffUrl}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="gap-2" asChild>
              <a href={staffUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Open staff page
              </a>
            </Button>
            <Button size="sm" variant="outline" className="gap-2" onClick={() => void handleCopy()}>
              <Copy className="h-3.5 w-3.5" />
              {isCopying ? "Copying..." : "Copy link"}
            </Button>
          </div>
          <div className="flex items-start gap-2 rounded-xl bg-background/70 px-3 py-2 text-xs text-muted-foreground">
            <LogIn className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>Staff use the shared email OTP login flow. No separate password setup is needed.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
