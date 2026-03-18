"use client"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar"
import { ChevronsUpDown, ImageIcon, Settings, Users } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useDomain } from "@/lib/domain-provider"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useTRPC } from "@/lib/trpc/client"
import { protocol,
  rootDomain } from "@/config"


export function DomainSwitchDropdown() {

  const trpc = useTRPC()
  const domain = useDomain()
  const { isMobile } = useSidebar()
  const router = useRouter()

  const [hasImageError, setHasImageError] = useState(false)

  const { data: marathon } = useSuspenseQuery(trpc.marathons.getByDomain.queryOptions({
    domain,
  }))

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
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground bg-muted border border-border rounded-xl"
        >
          <div className="flex aspect-square size-8 overflow-hidden items-center justify-center rounded-lg bg-muted border-border border-2">
            {marathon?.logoUrl && !hasImageError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={marathon.logoUrl}
                alt="Marathon logo"
                className="object-cover"
                onError={handleImageError}
                onLoad={handleImageLoad}
              />
            ) : (
              <ImageIcon className="size-4" />
            )}
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">
              {marathon?.name}
            </span>
            <span className="truncate text-xs">
              Mode:{" "}
              {marathon?.mode === "by-camera" ? "ByCamera" : "Marathon"}
            </span>
          </div>
          <ChevronsUpDown className="ml-auto" />
        </SidebarMenuButton>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-4"
        align="start"
        side={isMobile ? "bottom" : "right"}
        sideOffset={4}
      >
        {marathon ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-lg bg-muted border-border overflow-hidden border-2 ">
                {marathon.logoUrl && !hasImageError ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={marathon.logoUrl}
                    alt="Marathon logo"
                    className="object-cover"
                    onError={handleImageError}
                    onLoad={handleImageLoad}
                  />
                ) : (
                  <ImageIcon className="size-8" />
                )}
              </div>
              <div>
                <h3 className="font-gothic text-lg font-semibold">
                  {marathon.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {marathon.domain}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {marathon.description && (
                <p className="text-sm text-muted-foreground">
                  {marathon.description}
                </p>
              )}

              <div className="flex items-center gap-2 text-sm">
                <Settings className="size-4" />
                <span>
                  Mode:{" "}
                  {marathon.mode === "by-camera" ? "ByCamera" : "Marathon"}
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Users className="size-4" />
                <span>Domain: {marathon.domain}</span>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={handleSwitchMarathon}
              className="w-full"
            >
              Switch Marathon
            </Button>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">
              No marathon selected
            </p>
            <Button onClick={handleSwitchMarathon} className="mt-2">
              Select Marathon
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
