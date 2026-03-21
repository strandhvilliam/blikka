"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { authClient } from "@/lib/auth/client"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export function SelectDomainLogoutButton() {
  const router = useRouter()
  const [isLogoutLoading, setIsLogoutLoading] = useState(false)

  const handleLogout = async () => {
    try {
      setIsLogoutLoading(true)
      await authClient.signOut()
      router.push(`/auth/login?next=${encodeURIComponent("/admin")}`)
    } catch (error) {
      console.error(error)
      toast.error("Failed to sign out")
    } finally {
      setIsLogoutLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleLogout()}
      disabled={isLogoutLoading}
      className={cn(
        "flex items-center gap-1.5 rounded-full border border-brand-black/12 bg-white px-3 py-1.5 text-xs font-medium text-brand-black/70 shadow-[0_1px_4px_rgba(0,0,0,0.06)] transition-all hover:text-brand-black",
        isLogoutLoading && "pointer-events-none opacity-50",
      )}
      aria-label={isLogoutLoading ? "Signing out" : "Log out"}
    >
      <LogOut className="size-3.5 shrink-0" />
      <span>{isLogoutLoading ? "Signing out…" : "Log out"}</span>
    </button>
  )
}
