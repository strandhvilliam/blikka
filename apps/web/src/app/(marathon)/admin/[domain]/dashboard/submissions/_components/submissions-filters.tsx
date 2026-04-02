"use client"

import { useMemo, useState } from "react"
import { ChevronDown, Filter, Search, ArrowUpDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"

interface SubmissionsFiltersProps {
  search: string | null
  onSearchChange: (value: string | null) => void
  sortOrder: "asc" | "desc"
  onSortOrderChange: (value: "asc" | "desc") => void
  competitionClassId: number[] | null
  onCompetitionClassChange: (value: string) => void
  competitionClasses: { id: number; name: string }[]
  deviceGroupId: number[] | null
  onDeviceGroupChange: (value: string) => void
  deviceGroups: { id: number; name: string }[]
}

function SubmissionsFilterFields({
  search,
  onSearchChange,
  sortOrder,
  onSortOrderChange,
  competitionClassId,
  onCompetitionClassChange,
  competitionClasses,
  deviceGroupId,
  onDeviceGroupChange,
  deviceGroups,
  layout,
}: SubmissionsFiltersProps & { layout: "toolbar" | "sheet" }) {
  const fieldWrap = layout === "sheet" ? "flex flex-col gap-4" : "flex flex-col gap-3 md:flex-row md:items-center md:gap-3"

  return (
    <div className={fieldWrap}>
      <div className="relative w-full flex-1 md:min-w-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          type="text"
          placeholder="Search by reference, name, or email..."
          value={search || ""}
          onChange={(e) => onSearchChange(e.target.value || null)}
          className="h-9 w-full bg-background pl-9 text-sm"
        />
      </div>

      <div
        className={
          layout === "sheet"
            ? "flex flex-col gap-3"
            : "flex flex-col gap-3 md:flex-row md:flex-wrap md:w-auto"
        }
      >
        <Select value={sortOrder} onValueChange={onSortOrderChange}>
          <SelectTrigger className="h-9 w-full bg-background md:w-[160px]">
            <div className="flex items-center gap-2">
              <ArrowUpDown className="size-4 shrink-0 text-muted-foreground" />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">Newest First</SelectItem>
            <SelectItem value="asc">Oldest First</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={
            !competitionClassId || competitionClassId.length === 0
              ? "all"
              : competitionClassId.join(",")
          }
          onValueChange={onCompetitionClassChange}
        >
          <SelectTrigger className="h-9 w-full bg-background md:w-[220px]">
            <div className="flex items-center gap-2">
              <Filter className="size-4 shrink-0 text-muted-foreground" />
              <SelectValue placeholder="All Classes" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Competition Classes</SelectItem>
            {competitionClasses.map((cc) => (
              <SelectItem key={cc.id} value={cc.id.toString()}>
                {cc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={!deviceGroupId || deviceGroupId.length === 0 ? "all" : deviceGroupId.join(",")}
          onValueChange={onDeviceGroupChange}
        >
          <SelectTrigger className="h-9 w-full bg-background md:w-[200px]">
            <div className="flex items-center gap-2">
              <Filter className="size-4 shrink-0 text-muted-foreground" />
              <SelectValue placeholder="All Groups" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Device Groups</SelectItem>
            {deviceGroups.map((dg) => (
              <SelectItem key={dg.id} value={dg.id.toString()}>
                {dg.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

export function SubmissionsFilters(props: SubmissionsFiltersProps) {
  const isMobile = useIsMobile()
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false)

  const filterCount = useMemo(() => {
    let n = 0
    if (props.search && props.search.trim().length > 0) n += 1
    if (props.competitionClassId && props.competitionClassId.length > 0) n += 1
    if (props.deviceGroupId && props.deviceGroupId.length > 0) n += 1
    return n
  }, [props.search, props.competitionClassId, props.deviceGroupId])

  if (isMobile) {
    return (
      <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "h-10 w-full justify-between gap-2 font-normal",
              filterCount > 0 && "border-brand-primary/40",
            )}
            aria-label="Open search and filters"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Filter className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate text-sm">Filters & search</span>
              {filterCount > 0 ? (
                <Badge variant="secondary" className="h-5 min-w-5 shrink-0 px-1 tabular-nums">
                  {filterCount}
                </Badge>
              ) : null}
            </span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[min(90vh,36rem)] gap-0 rounded-t-xl p-0">
          <SheetHeader className="border-b border-border p-4 text-left">
            <SheetTitle className="text-base">Search & filters</SheetTitle>
          </SheetHeader>
          <div className="max-h-[calc(min(90vh,36rem)-4.5rem)] overflow-y-auto p-4 pb-8">
            <SubmissionsFilterFields {...props} layout="sheet" />
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return <SubmissionsFilterFields {...props} layout="toolbar" />
}
