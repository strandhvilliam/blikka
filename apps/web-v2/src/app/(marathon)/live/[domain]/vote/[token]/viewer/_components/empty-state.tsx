"use client";

import { useVotingSearchParams } from "../_hooks/use-voting-search-params";

export function EmptyState() {
  const { currentFilter, setCurrentFilter } = useVotingSearchParams();
  const onClearFilter = () => {
    setCurrentFilter(null);
  };
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-2">
      <div className="text-center max-w-md">
        <h2 className="text-xl font-semibold mb-2">No images to review</h2>
        <p className="text-muted-foreground mb-4">
          {currentFilter !== null
            ? `No images rated ${currentFilter} stars`
            : "There are no images to review at this time."}
        </p>
        {currentFilter !== null && (
          <button
            onClick={onClearFilter}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
          >
            Show all images
          </button>
        )}
      </div>
    </div>
  );
}
