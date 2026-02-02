import { CarouselApi } from "@/components/ui/carousel";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useVotingSearchParams } from "./use-voting-search-params";



const CarouselApiContext = createContext<{ api: CarouselApi | null, setApi: (api: CarouselApi) => void, isNavigatingRef: React.RefObject<boolean> } | null>(null);

export function useVotingCarouselApi() {
  const context = useContext(CarouselApiContext);
  if (!context) {
    throw new Error("useCarouselApi must be used within a CarouselApiProvider");
  }
  return context;
}

export function VotingCarouselApiProvider({ children }: { children: React.ReactNode }) {
  const [api, setApi] = useState<CarouselApi | null>(null);
  const isNavigatingRef = useRef(false);

  const { currentImageIndex, setCurrentImageIndex } = useVotingSearchParams();

  useEffect(() => {
    if (!api) return;

    const onSelect = () => {
      // Skip if we're programmatically navigating (URL change -> carousel scroll)
      if (isNavigatingRef.current) return;

      const index = api.selectedScrollSnap();
      if (index !== currentImageIndex) {
        setCurrentImageIndex(index);
      }
    };

    api.on("select", onSelect);

    return () => {
      api.off("select", onSelect);
    };
  }, [api, currentImageIndex, setCurrentImageIndex]);

  useEffect(() => {
    if (api) {
      isNavigatingRef.current = true;
      api.scrollTo(currentImageIndex);
      // Reset flag after scroll animation
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 100);
    }
  }, [api, currentImageIndex]);

  const value = {
    api,
    isNavigatingRef,
    setApi,
  }

  return (
    <CarouselApiContext.Provider value={value} >
      {children}
    </CarouselApiContext.Provider>
  );
} 