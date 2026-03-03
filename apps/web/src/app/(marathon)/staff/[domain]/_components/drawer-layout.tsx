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
      <DrawerContent
        className="h-[94dvh] rounded-t-[2rem] border-none bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,244,239,0.94))] p-0 shadow-2xl"
      >
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
