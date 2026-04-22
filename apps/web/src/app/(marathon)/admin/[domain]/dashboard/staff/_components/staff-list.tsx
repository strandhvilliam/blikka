"use client"

import { Search, User2Icon } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"

interface StaffListProps {
  selectedAccessId?: string
  onSelectAccess: (id: string) => void
}

export function StaffList({ selectedAccessId, onSelectAccess }: StaffListProps) {
  const domain = useDomain()
  const trpc = useTRPC()
  const { data: staffMembers } = useSuspenseQuery(
    trpc.users.getStaffMembersByDomain.queryOptions({
      domain,
    })
  )

  const [search, setSearch] = useState("")
  const filteredStaff = useMemo(() => {
    if (!search.trim()) return staffMembers
    const searchLower = search.toLowerCase()
    return staffMembers.filter(
      (staff) =>
        staff.name.toLowerCase().includes(searchLower) ||
        staff.email.toLowerCase().includes(searchLower)
    )
  }, [search, staffMembers])

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-3 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search staff..."
            className="h-9 border-border/40 bg-muted/50 pl-9 focus-visible:ring-1 focus-visible:ring-primary/20"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <ScrollArea className="min-h-0 min-w-0 flex-1 [&_[data-slot=scroll-area-viewport]]:min-w-0">
        <div className="min-w-0 space-y-0.5">
          {filteredStaff.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <User2Icon className="h-12 w-12 mb-3 text-muted-foreground/50" />
              <p className="text-sm font-medium text-muted-foreground">
                {search ? "No staff members found" : "No staff members yet"}
              </p>
              {search && (
                <p className="text-xs text-muted-foreground mt-1">
                  Try adjusting your search query
                </p>
              )}
            </div>
          ) : (
            filteredStaff.map((staff) => {
              const isActive = selectedAccessId === staff.id
              return (
                <button
                  key={staff.id}
                  type="button"
                  onClick={() => onSelectAccess(staff.id)}
                  className={cn(
                    "block w-full min-w-0 max-w-full px-3 py-2.5 text-left transition-all hover:bg-muted/50",
                    isActive && "border-l-2 border-primary bg-muted/80",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 ring-2 ring-primary/10 ring-offset-1 ring-offset-background">
                      <AvatarFallback className="bg-muted">
                        {staff.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-0.5 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{staff.name}</p>
                        <Badge
                          variant={
                            staff.kind === "pending"
                              ? "outline"
                              : staff.role === "admin"
                                ? "default"
                                : "secondary"
                          }
                          className={cn(
                            "text-[10px] h-4 px-1.5 shrink-0",
                            isActive &&
                              staff.kind === "active" &&
                              staff.role === "staff" &&
                              "bg-primary/10 text-primary",
                            staff.kind === "pending" &&
                              "border-amber-200 bg-amber-50 text-amber-700"
                          )}
                        >
                          {staff.kind === "pending"
                            ? "Pending"
                            : staff.role.charAt(0).toUpperCase() + staff.role.slice(1)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{staff.email}</p>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
