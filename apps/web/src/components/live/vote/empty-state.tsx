"use client"

import { useTranslations } from "next-intl"
import { useVotingSearchParams } from "@/app/(marathon)/live/[domain]/vote/[token]/viewer/_hooks/use-voting-search-params"

export function EmptyState() {
  const { currentFilter, setCurrentFilter } = useVotingSearchParams()
  const t = useTranslations("VotingViewerPage")

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-2">
      <div className="max-w-md text-center">
        <h2 className="font-gothic text-xl font-medium tracking-tight text-foreground">
          {t("emptyState.title")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {currentFilter !== null
            ? t("emptyState.filteredDescription", { rating: currentFilter })
            : t("emptyState.defaultDescription")}
        </p>
        {currentFilter !== null && (
          <button
            onClick={() => setCurrentFilter(null)}
            className="mt-4 rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
          >
            {t("emptyState.showAll")}
          </button>
        )}
      </div>
    </div>
  )
}
