"use client";

import { parseAsInteger, parseAsStringEnum, useQueryStates } from "nuqs";

const parseAsViewMode = parseAsStringEnum(["carousel", "grid"]);

export function useVotingSearchParams() {
  const [params, setParams] = useQueryStates(
    {
      image: parseAsInteger.withDefault(0),
      view: parseAsViewMode.withDefault("carousel"),
    },
    {
      urlKeys: {
        image: "i",
        view: "v",
      },
      shallow: true,
    },
  );

  return {
    currentImageIndex: params.image,
    viewMode: params.view,
    setCurrentImageIndex: (index: number) =>
      setParams((prev) => ({ ...prev, image: index })),
    setViewMode: (view: "carousel" | "grid") =>
      setParams((prev) => ({ ...prev, view })),
    setParams,
  };
}
