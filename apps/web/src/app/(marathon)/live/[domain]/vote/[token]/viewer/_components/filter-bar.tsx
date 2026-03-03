"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { Star, Info, Languages, Check } from "lucide-react";
import { VotingInfoDrawer } from "./voting-info-drawer";
import { useVotingSearchParams } from "../_hooks/use-voting-search-params";
import { useLocale, Locale } from "next-intl";
import { useTransition } from "react";
import ReactCountryFlag from "react-country-flag";
import { changeLocaleAction } from "@/lib/actions/change-locale-action";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FilterBarProps {
  ratingCounts: Record<number, number>;
  totalCount: number;
  onViewModeChange: (mode: "carousel" | "grid") => void;
  ratedCount: number;
  className?: string;
}

const filterOptions = [
  { value: null, label: "All" },
  { value: 5, label: "5" },
  { value: 4, label: "4" },
  { value: 3, label: "3" },
  { value: 2, label: "2" },
  { value: 1, label: "1" },
];

export function FilterBar({
  ratingCounts,
  totalCount,
  onViewModeChange,
  ratedCount,
  className,
}: FilterBarProps) {
  const {
    currentImageIndex,
    setCurrentImageIndex,
    viewMode,
    currentFilter,
    setCurrentFilter,
  } = useVotingSearchParams();

  const handleFilterChange = async (filter: number | null) => {
    await setCurrentFilter(filter);
    await setCurrentImageIndex(0);
  };

  const progress = totalCount > 0 ? Math.round(((currentImageIndex + 1) / totalCount) * 100) : 0;

  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const setLocale = (newLocale: Locale) => {
    if (newLocale === locale || isPending) return;
    startTransition(async () => {
      const response = await changeLocaleAction(newLocale);
      if (response.error) {
        console.error("Failed to change locale:", response.error);
        return;
      }
      router.refresh();
    });
  };

  const visibleCurrentIndex = totalCount > 0 ? currentImageIndex + 1 : 0;

  const renderFilterOption = (option: (typeof filterOptions)[number]) => {
    const count =
      option.value === null
        ? Object.values(ratingCounts).reduce((a, b) => a + b, 0)
        : ratingCounts[option.value] || 0;

    const isActive = currentFilter === option.value;

    return (
      <button
        key={String(option.value)}
        onClick={() => handleFilterChange(option.value)}
        className={cn(
          "flex items-center gap-0.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all shrink-0",
          isActive
            ? "bg-foreground text-background"
            : "bg-muted/50 text-muted-foreground hover:bg-muted",
        )}
      >
        {option.value !== null && <Star className="w-3 h-3 fill-current" />}
        {option.label}
        {count > 0 && <span className="ml-0.5 opacity-60">({count})</span>}
      </button>
    );
  };

  return (
    <div
      className={cn(
        "px-4 py-3 bg-background border-b border-border",
        className,
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <VotingInfoDrawer votingInfo={{ rated: ratedCount, total: totalCount }}>
          <button
            className="h-10 w-10 rounded-xl bg-muted/50 border-0 shadow-sm hover:bg-muted active:scale-[0.98] flex items-center justify-center transition-all"
            aria-label="How voting works"
          >
            <Info className="w-5 h-5" />
          </button>
        </VotingInfoDrawer>

        <div className="flex items-center gap-1.5">
          <Image
            src="/blikka-logo.svg"
            alt="Blikka"
            width={20}
            height={17}
            className="w-5 h-[17px]"
          />
          <span className="font-rocgrotesk font-bold text-base tracking-tight">
            blikka
          </span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              disabled={isPending}
              className="h-10 w-10 rounded-xl bg-muted/50 border-0 shadow-sm hover:bg-muted active:scale-[0.98] flex items-center justify-center transition-all"
              aria-label="Change language"
            >
              <Languages className="w-5 h-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[140px]">
            <DropdownMenuItem
              onClick={() => setLocale("en")}
              className={cn(
                "flex items-center gap-2 cursor-pointer",
                locale === "en" && "bg-accent",
              )}
            >
              <ReactCountryFlag countryCode="GB" svg className="w-5 h-5" />
              <span className="flex-1">English</span>
              {locale === "en" && <Check className="w-4 h-4" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setLocale("sv")}
              className={cn(
                "flex items-center gap-2 cursor-pointer",
                locale === "sv" && "bg-accent",
              )}
            >
              <ReactCountryFlag countryCode="SE" svg className="w-5 h-5" />
              <span className="flex-1">Svenska</span>
              {locale === "sv" && <Check className="w-4 h-4" />}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
          <span className="font-medium text-foreground">
            {visibleCurrentIndex}{" "}
            <span className="text-muted-foreground">of</span> {totalCount}
          </span>
          <span>{progress}%</span>
        </div>
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Filter options - always visible */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
        {filterOptions.map((option) => {
          return renderFilterOption(option);
        })}
      </div>
    </div>
  );
}
