"use client";

import { useTranslations } from "next-intl";
import { useVotingSearchParams } from "../_hooks/use-voting-search-params";

export function EmptyState() {
  const { currentFilter, setCurrentFilter } = useVotingSearchParams();
  const t = useTranslations("VotingViewerPage");

  const onClearFilter = () => {
    setCurrentFilter(null);
  };
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-2">
      <div className="text-center max-w-md">
        <h2 className="text-xl font-semibold mb-2">
          {t("emptyState.title")}
        </h2>
        <p className="text-muted-foreground mb-4">
          {currentFilter !== null
            ? t("emptyState.filteredDescription", {
                rating: currentFilter,
              })
            : t("emptyState.defaultDescription")}
        </p>
        {currentFilter !== null && (
          <button
            onClick={onClearFilter}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
          >
            {t("emptyState.showAll")}
          </button>
        )}
      </div>
    </div>
  );
}
