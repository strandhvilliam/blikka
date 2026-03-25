"use client";

import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { parseAsInteger, useQueryState } from "nuqs";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  Loader2,
} from "lucide-react";
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import type {
  JuryInvitation,
  JuryRatingsResponse,
} from "../../_lib/jury-types";
import {
  getFinalRankingLabel,
  getParticipantFinalRanking,
} from "../_lib/jury-final-ranking-state";
import type { JuryListParticipant } from "../_lib/jury-list-participant";
import { getParticipantAssetUrl } from "../_lib/jury-list-participant";
import { ActiveRatingFilterBadge } from "./rating-filter";
import { JurySidebar } from "./jury-sidebar";

export function JurySubmissionViewer({
  domain,
  token,
  invitation,
  participants,
  initialIndex,
  selectedRatings,
  ratings,
  totalParticipants,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  ratingByParticipantId,
  onBack,
}: {
  domain: string;
  token: string;
  invitation: JuryInvitation;
  participants: JuryListParticipant[];
  initialIndex: number;
  selectedRatings: number[];
  ratings: JuryRatingsResponse["ratings"];
  totalParticipants: number;
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  ratingByParticipantId: Map<number, JuryRatingsResponse["ratings"][number]>;
  onBack: () => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [currentParticipantIndex, setCurrentParticipantIndex] = useQueryState(
    "index",
    parseAsInteger.withDefault(initialIndex),
  );
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const currentParticipant =
    participants[currentParticipantIndex] ?? participants[0] ?? null;

  const currentParticipantId = currentParticipant?.id ?? null;
  const currentAssetUrl = getParticipantAssetUrl(
    currentParticipant,
    invitation,
  );
  const currentAssetId = String(
    currentParticipant?.submission?.id ?? currentParticipant?.id ?? "",
  );

  const existingRating = useMemo(
    () =>
      currentParticipantId === null
        ? undefined
        : ratingByParticipantId.get(currentParticipantId),
    [currentParticipantId, ratingByParticipantId],
  );

  const [localRating, setLocalRating] = useState(existingRating?.rating ?? 0);
  const [localNotes, setLocalNotes] = useState(existingRating?.notes ?? "");
  const [localFinalRanking, setLocalFinalRanking] = useState<1 | 2 | 3 | null>(
    getParticipantFinalRanking(ratings, currentParticipantId ?? -1),
  );
  const notesTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalRating(existingRating?.rating ?? 0);
    setLocalNotes(existingRating?.notes ?? "");
    setLocalFinalRanking(
      getParticipantFinalRanking(ratings, currentParticipantId ?? -1),
    );
  }, [existingRating, currentParticipantId]);

  useEffect(() => {
    if (
      participants.length - currentParticipantIndex <= 4 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  }, [
    currentParticipantIndex,
    participants.length,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ]);

  useEffect(() => {
    return () => {
      if (notesTimeoutRef.current) {
        clearTimeout(notesTimeoutRef.current);
      }
    };
  }, []);

  const invalidateJuryQueries = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: trpc.jury.pathKey(),
    });
  }, [queryClient, trpc.jury]);

  const createRatingMutation = useMutation(
    trpc.jury.createRating.mutationOptions({
      onSettled: invalidateJuryQueries,
    }),
  );

  const updateRatingMutation = useMutation(
    trpc.jury.updateRating.mutationOptions({
      onSettled: invalidateJuryQueries,
    }),
  );

  const deleteRatingMutation = useMutation(
    trpc.jury.deleteRating.mutationOptions({
      onSettled: invalidateJuryQueries,
    }),
  );

  const saveRating = useCallback(
    async (
      nextRating: number,
      nextNotes: string,
      nextFinalRanking: 1 | 2 | 3 | null,
    ) => {
      if (!currentParticipantId) return;

      setIsSaving(true);
      try {
        if (existingRating) {
          if (
            nextRating === 0 &&
            !nextNotes.trim() &&
            nextFinalRanking === null
          ) {
            await deleteRatingMutation.mutateAsync({
              token,
              domain,
              participantId: currentParticipantId,
            });
          } else {
            await updateRatingMutation.mutateAsync({
              token,
              domain,
              participantId: currentParticipantId,
              rating: nextRating,
              notes: nextNotes,
              finalRanking: nextFinalRanking,
            });
          }
        } else if (
          nextRating > 0 ||
          nextNotes.trim() ||
          nextFinalRanking !== null
        ) {
          await createRatingMutation.mutateAsync({
            token,
            domain,
            participantId: currentParticipantId,
            rating: nextRating,
            notes: nextNotes,
            finalRanking: nextFinalRanking,
          });
        }
      } catch (error) {
        console.error("Failed to save rating", error);
        toast.error("Failed to save review changes");
      } finally {
        setIsSaving(false);
      }
    },
    [
      createRatingMutation,
      currentParticipantId,
      deleteRatingMutation,
      domain,
      existingRating,
      token,
      updateRatingMutation,
    ],
  );

  const handleRatingClick = useCallback(
    (star: number) => {
      const nextRating = star === localRating ? 0 : star;
      setLocalRating(nextRating);
      void saveRating(nextRating, localNotes, localFinalRanking);
    },
    [localFinalRanking, localNotes, localRating, saveRating],
  );

  const handleFinalRankingClick = useCallback(
    (finalRanking: 1 | 2 | 3) => {
      const nextFinalRanking =
        localFinalRanking === finalRanking ? null : finalRanking;
      setLocalFinalRanking(nextFinalRanking);
      void saveRating(localRating, localNotes, nextFinalRanking);
    },
    [localFinalRanking, localNotes, localRating, saveRating],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLInputElement
      ) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setCurrentParticipantIndex(Math.max(0, currentParticipantIndex - 1));
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        setCurrentParticipantIndex(
          Math.min(participants.length - 1, currentParticipantIndex + 1),
        );
      }

      if (event.key === "Escape") {
        event.preventDefault();
        onBack();
      }

      if (
        (event.metaKey || event.ctrlKey) &&
        ["0", "1", "2", "3", "4", "5"].includes(event.key)
      ) {
        event.preventDefault();
        handleRatingClick(Number(event.key));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    currentParticipantIndex,
    handleRatingClick,
    onBack,
    participants.length,
    setCurrentParticipantIndex,
  ]);

  const handleNotesChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const nextNotes = event.target.value;
      setLocalNotes(nextNotes);

      if (notesTimeoutRef.current) {
        clearTimeout(notesTimeoutRef.current);
      }

      notesTimeoutRef.current = setTimeout(() => {
        void saveRating(localRating, nextNotes, localFinalRanking);
      }, 800);
    },
    [localFinalRanking, localRating, saveRating],
  );

  if (!currentParticipant) {
    return (
      <div className="space-y-3">
        <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-white px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-neutral-50 px-3 py-2 text-sm font-medium text-brand-black transition-colors hover:bg-neutral-100"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              List
            </button>
            <ActiveRatingFilterBadge selectedRatings={selectedRatings} />
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-white px-6 py-16 text-center">
          <p className="text-sm text-brand-gray">No participant selected.</p>
        </div>
      </div>
    );
  }

  const visibleTotal = totalParticipants;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-white px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-neutral-50 px-3 py-2 text-sm font-medium text-brand-black transition-colors hover:bg-neutral-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            List
          </button>
          <ActiveRatingFilterBadge selectedRatings={selectedRatings} />
          <span className="font-rocgrotesk text-sm font-bold text-brand-black">
            {currentParticipantIndex + 1}
            <span className="font-sans font-normal text-brand-gray">
              {" "}
              / {visibleTotal}
            </span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {[1, 2, 3].map((rank) => {
            const isActive = localFinalRanking === rank;

            return (
              <button
                key={rank}
                type="button"
                className={`inline-flex min-w-20 items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition-all ${
                  isActive
                    ? "border-brand-primary bg-brand-primary text-white shadow-[0_10px_26px_rgba(254,77,58,0.24)]"
                    : "border-border/60 bg-neutral-50 text-brand-black hover:border-brand-primary/30 hover:bg-white"
                }`}
                onClick={() => handleFinalRankingClick(rank as 1 | 2 | 3)}
              >
                {getFinalRankingLabel(rank as 1 | 2 | 3)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="overflow-hidden rounded-xl border border-border/60 bg-neutral-950">
          <div className="relative flex min-h-[60vh] items-center justify-center">
            {currentAssetUrl && !imageErrors.has(currentAssetId) ? (
              <img
                src={currentAssetUrl}
                alt={currentParticipant.reference}
                className="max-h-[75vh] max-w-full object-contain"
                onError={() =>
                  setImageErrors((prev) => new Set(prev).add(currentAssetId))
                }
              />
            ) : (
              <div className="flex max-w-sm flex-col items-center justify-center px-6 text-center">
                <ImageOff className="mb-4 h-12 w-12 text-white/30" />
                <p className="font-rocgrotesk text-lg font-bold text-white/80">
                  {invitation.inviteType === "class"
                    ? "Contact sheet unavailable"
                    : "Image unavailable"}
                </p>
                <p className="mt-2 text-sm text-white/40">
                  The asset could not be loaded for this participant.
                </p>
              </div>
            )}

            <button
              type="button"
              className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70 disabled:opacity-30"
              disabled={currentParticipantIndex === 0}
              onClick={() =>
                setCurrentParticipantIndex(
                  Math.max(0, currentParticipantIndex - 1),
                )
              }
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <button
              type="button"
              className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70 disabled:opacity-30"
              disabled={currentParticipantIndex >= participants.length - 1}
              onClick={() =>
                setCurrentParticipantIndex(
                  Math.min(
                    participants.length - 1,
                    currentParticipantIndex + 1,
                  ),
                )
              }
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {isFetchingNextPage ? (
              <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-xs text-white/80 backdrop-blur-sm">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading
              </div>
            ) : null}
          </div>
        </div>

        <JurySidebar
          participant={currentParticipant}
          invitation={invitation}
          rating={localRating}
          notes={localNotes}
          isSaving={isSaving}
          onRatingClick={handleRatingClick}
          onNotesChange={handleNotesChange}
        />
      </div>
    </div>
  );
}
