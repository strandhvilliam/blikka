import { format } from "date-fns";
import { buildS3Url } from "@/lib/utils";

export function toDateTimeLocalValue(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

export function toIsoFromLocal(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

export function hasValidDateRange(
  startsAtIso: string | null,
  endsAtIso: string | null,
) {
  if (!startsAtIso || !endsAtIso) {
    return false;
  }

  return new Date(endsAtIso).getTime() > new Date(startsAtIso).getTime();
}

export function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return format(new Date(value), "MMM d, yyyy HH:mm");
}

export function getSubmissionImageUrl(
  submissionThumbnailKey?: string | null,
  submissionKey?: string | null,
) {
  const thumbnailBucket = process.env.NEXT_PUBLIC_THUMBNAILS_BUCKET_NAME;
  const submissionsBucket = process.env.NEXT_PUBLIC_SUBMISSIONS_BUCKET_NAME;

  return (
    buildS3Url(thumbnailBucket, submissionThumbnailKey) ??
    buildS3Url(submissionsBucket, submissionKey)
  );
}

/** Original submission object in the submissions bucket (not the thumbnail). */
export function getSubmissionFullImageUrl(submissionKey?: string | null) {
  const submissionsBucket = process.env.NEXT_PUBLIC_SUBMISSIONS_BUCKET_NAME;
  return buildS3Url(submissionsBucket, submissionKey);
}

export const VOTING_PAGE_SIZE = 50;

/** Wide underline tabs: equal segments, brand accent bar under active tab. */
export const tabTriggerClassName =
  "relative min-h-12 min-w-0 flex-1 justify-center py-4 px-0 text-base font-semibold transition-colors rounded-none bg-transparent border-none shadow-none text-muted-foreground hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-brand-primary data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-brand-primary data-[state=active]:after:content-['']";
