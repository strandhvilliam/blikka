"use client"

import Image from "next/image"
import { cn } from "@/lib/utils"
import { Star, Info, Languages, Check } from "lucide-react"
import { VotingInfoDrawer } from "./voting-info-drawer"
import { useVotingSearchParams } from "@/app/(marathon)/live/[domain]/vote/[token]/viewer/_hooks/use-voting-search-params"
import { useLocale, Locale, useTranslations } from "next-intl"
import { useTransition } from "react"
import ReactCountryFlag from "react-country-flag"
import { changeLocaleAction } from "@/lib/actions/change-locale-action"
import { useRouter } from "next/navigation"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface FilterBarProps {
  ratingCounts: Record<number, number>
  totalCount: number
  reviewTotalCount: number
  ratedCount: number
  className?: string
}

const filterOptions = [
  { value: null, labelKey: "all" },
  { value: 5, label: "5" },
  { value: 4, label: "4" },
  { value: 3, label: "3" },
  { value: 2, label: "2" },
  { value: 1, label: "1" },
]

export function FilterBar({
  ratingCounts,
  totalCount,
  reviewTotalCount,
  ratedCount,
  className,
}: FilterBarProps) {
  const { currentImageIndex, setCurrentImageIndex, currentFilter, setCurrentFilter } =
    useVotingSearchParams()

  const handleFilterChange = async (filter: number | null) => {
    await setCurrentFilter(filter)
    await setCurrentImageIndex(0)
  }

  const progress = totalCount > 0 ? Math.round(((currentImageIndex + 1) / totalCount) * 100) : 0

  const locale = useLocale()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const t = useTranslations("VotingViewerPage")

  const setLocale = (newLocale: Locale) => {
    if (newLocale === locale || isPending) return
    startTransition(async () => {
      const response = await changeLocaleAction(newLocale)
      if (response.error) {
        console.error("Failed to change locale:", response.error)
        return
      }
      router.refresh()
    })
  }

  const visibleCurrentIndex = totalCount > 0 ? currentImageIndex + 1 : 0

  const renderFilterOption = (option: (typeof filterOptions)[number]) => {
    const count =
      option.value === null
        ? Object.values(ratingCounts).reduce((a, b) => a + b, 0)
        : ratingCounts[option.value] || 0

    const isActive = currentFilter === option.value

    return (
      <button
        key={String(option.value)}
        onClick={() => handleFilterChange(option.value)}
        className={cn(
          "flex shrink-0 items-center gap-0.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
          isActive
            ? "bg-foreground text-background"
            : "bg-muted/50 text-muted-foreground hover:bg-muted",
        )}
      >
        {option.value !== null && <Star className="h-3 w-3 fill-current" />}
        {option.value === null ? t("filterBar.all") : option.label}
        {count > 0 && <span className="ml-0.5 opacity-60">({count})</span>}
      </button>
    )
  }

  return (
    <div className={cn("border-b border-border bg-background px-4 py-3", className)}>
      <div className="mb-3 flex items-center justify-between">
        <VotingInfoDrawer votingInfo={{ rated: ratedCount, total: reviewTotalCount }}>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/50 shadow-sm transition-all hover:bg-muted active:scale-[0.98]"
            aria-label={t("infoDrawer.triggerLabel")}
          >
            <Info className="h-5 w-5" />
          </button>
        </VotingInfoDrawer>

        <div className="flex items-center gap-1.5">
          <Image
            src="/blikka-logo.svg"
            alt="Blikka"
            width={20}
            height={17}
            className="h-[17px] w-5"
          />
          <span className="font-special-gothic text-base tracking-tight">blikka</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              disabled={isPending}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/50 shadow-sm transition-all hover:bg-muted active:scale-[0.98]"
              aria-label={t("filterBar.changeLanguage")}
            >
              <Languages className="h-5 w-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[140px]">
            <DropdownMenuItem
              onClick={() => setLocale("en")}
              className={cn("flex cursor-pointer items-center gap-2", locale === "en" && "bg-accent")}
            >
              <ReactCountryFlag countryCode="GB" svg className="h-5 w-5" />
              <span className="flex-1">English</span>
              {locale === "en" && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setLocale("sv")}
              className={cn("flex cursor-pointer items-center gap-2", locale === "sv" && "bg-accent")}
            >
              <ReactCountryFlag countryCode="SE" svg className="h-5 w-5" />
              <span className="flex-1">Svenska</span>
              {locale === "sv" && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Progress */}
      <div className="mb-3">
        <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {t("filterBar.photoProgress", {
              current: visibleCurrentIndex,
              total: totalCount,
            })}
          </span>
          <span>{progress}%</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-foreground transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Filters */}
      <p className="mb-1.5 text-xs text-muted-foreground">{t("filterBar.ratingFilterHint")}</p>
      <div className="scrollbar-hide flex items-center gap-1.5 overflow-x-auto">
        {filterOptions.map((option) => renderFilterOption(option))}
      </div>
    </div>
  )
}
