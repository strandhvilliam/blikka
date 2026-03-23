"use client"

import type { ReactNode } from "react"
import { XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer"

interface DrawerLayoutProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  children: ReactNode
}

export function DrawerLayout({ open, onOpenChange, title, children }: DrawerLayoutProps) {
  return (
    <Drawer modal={true} open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex h-[97dvh] flex-col overflow-hidden rounded-t-[2rem] border-none bg-white p-0 shadow-2xl">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onOpenChange(false)}
          className="absolute right-3 top-3 z-20 h-10 w-10 rounded-full border bg-white/90 shadow-sm backdrop-blur-sm"
        >
          <XIcon className="h-5 w-5" />
        </Button>
        {title ? <DrawerTitle className="sr-only">{title}</DrawerTitle> : null}
        {children}
      </DrawerContent>
    </Drawer>
  )
}
