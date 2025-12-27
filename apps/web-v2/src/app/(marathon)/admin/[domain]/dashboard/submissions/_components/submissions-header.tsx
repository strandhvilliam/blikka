"use client"

import { Plus, BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Tab = "all" | "initialized" | "not-verified" | "verified" | "validation-errors"

interface SubmissionsHeaderProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

export function SubmissionsHeader({ activeTab, onTabChange }: SubmissionsHeaderProps) {
  const tabs: { value: Tab; label: string }[] = [
    { value: "all", label: "All Submissions" },
    { value: "initialized", label: "Initialized" },
    { value: "not-verified", label: "Not Verified" },
    { value: "verified", label: "Verified" },
    { value: "validation-errors", label: "Validation Errors" },
  ]

  return (
    <div className="space-y-4">
      {/* Title and Action Buttons */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight font-rocgrotesk">Submissions</h1>
          <p className="text-muted-foreground text-sm">
            View and manage photo submissions from participants
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="default" className="gap-2">
            <BarChart3 className="size-4" />
            Analyze
          </Button>
          <Button
            variant="default"
            size="default"
            className="gap-2 bg-[#FF5D4B] hover:bg-[#E32D18] dark:bg-[#FF7A6B] dark:hover:bg-[#E55A47] text-white"
          >
            <Plus className="size-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="border-b border-border">
        <nav className="flex gap-8 -mb-px" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.value
            return (
              <button
                key={tab.value}
                onClick={() => onTabChange(tab.value)}
                className={cn(
                  "relative py-4 text-sm font-medium transition-colors outline-none",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-t",
                  isActive
                    ? "text-[#FF5D4B] dark:text-[#FF7A6B]"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {tab.label}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF5D4B] dark:bg-[#FF7A6B]"
                    aria-hidden="true"
                  />
                )}
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
