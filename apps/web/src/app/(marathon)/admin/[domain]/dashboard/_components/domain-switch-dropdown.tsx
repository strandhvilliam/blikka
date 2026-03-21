"use client"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ChevronsUpDown, Globe, ImageIcon, Settings } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useDomain } from "@/lib/domain-provider"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useTRPC } from "@/lib/trpc/client"
import { protocol, rootDomain } from "@/config"
import { cn } from "@/lib/utils"

function modeLabel(mode: string | undefined) {
  if (mode === "by-camera") return "By camera"
  return "Marathon"
}

export function DomainSwitchDropdown() {
  const trpc = useTRPC()
  const domain = useDomain()
  const router = useRouter()

  const [hasImageError, setHasImageError] = useState(false)

  const { data: marathon } = useSuspenseQuery(
    trpc.marathons.getByDomain.queryOptions({
      domain,
    }),
  )

  const handleImageError = () => {
    setHasImageError(true)
  }

  const handleImageLoad = () => {
    setHasImageError(false)
  }

  const handleSwitchMarathon = () => {
    router.push(`${protocol}://${rootDomain}/admin`)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 w-full min-w-0 max-w-full items-center gap-2 rounded-full border border-border/60 bg-sidebar-accent/50 px-2.5 py-0 text-left",
            "text-sidebar-foreground/90 transition-all duration-150 select-none",
            "hover:bg-sidebar-accent hover:border-border hover:text-sidebar-foreground hover:shadow-xs",
            "data-[state=open]:bg-sidebar-accent data-[state=open]:border-border data-[state=open]:shadow-xs",
            "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
          )}
        >
          <div className="flex size-7 shrink-0 overflow-hidden items-center justify-center rounded-md border border-border/50 bg-background/60">
            {marathon?.logoUrl && !hasImageError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={marathon.logoUrl}
                alt=""
                className="size-full object-cover"
                onError={handleImageError}
                onLoad={handleImageLoad}
              />
            ) : (
              <ImageIcon className="size-3.5 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-xs font-medium">
              {marathon?.name ?? "Marathon"}
            </span>
            <span className="block truncate text-[10px] text-muted-foreground">
              {marathon ? modeLabel(marathon.mode) : "—"}
            </span>
          </div>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 overflow-hidden border-border/80 p-0 shadow-lg"
        align="start"
        side="bottom"
        sideOffset={6}
      >
        {marathon ? (
          <div>
            <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
              <div className="flex gap-3">
                <div className="flex size-11 shrink-0 overflow-hidden items-center justify-center rounded-lg border border-border/60 bg-background">
                  {marathon.logoUrl && !hasImageError ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={marathon.logoUrl}
                      alt=""
                      className="size-full object-cover"
                      onError={handleImageError}
                      onLoad={handleImageLoad}
                    />
                  ) : (
                    <ImageIcon className="size-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-gothic text-base font-semibold leading-snug tracking-tight">
                    {marathon.name}
                  </h3>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                    {marathon.domain}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 px-4 py-3">
              {marathon.description ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {marathon.description}
                </p>
              ) : null}

              <dl className="space-y-2 text-xs">
                <div className="flex items-start gap-2.5">
                  <Settings
                    className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <div>
                    <dt className="text-muted-foreground">Mode</dt>
                    <dd className="font-medium text-foreground">
                      {modeLabel(marathon.mode)}
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Globe
                    className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <dt className="text-muted-foreground">Domain</dt>
                    <dd className="truncate font-mono text-[11px] font-medium text-foreground">
                      {marathon.domain}
                    </dd>
                  </div>
                </div>
              </dl>
            </div>

            <div className="border-t border-border/60 bg-muted/20 px-4 py-3">
              <Button
                size="sm"
                variant="secondary"
                onClick={handleSwitchMarathon}
                className="h-8 w-full rounded-full text-xs font-medium"
              >
                Switch marathon
              </Button>
            </div>
          </div>
        ) : (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">No marathon selected</p>
            <Button
              onClick={handleSwitchMarathon}
              className="mt-3 h-8 rounded-full px-4 text-xs"
            >
              Select marathon
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
