import type { ParticipantState } from "@blikka/kv-store";

const VALID_PHOTO_COUNTS = [8, 24];

export const generateContactSheetKey = (
  domain: string,
  reference: string,
  timestamp: string,
) =>
  `${domain}/${reference}/contact_sheet_${reference}_${timestamp.replace(/[:.]/g, "-").slice(0, -5)}.jpg`;

export type ContactSheetSkipReason =
  | "participant-state-not-finalized"
  | "contact-sheet-already-generated"
  | "single-photo-participant";

export const getContactSheetSkipReason = (
  kvData: ParticipantState,
): ContactSheetSkipReason | undefined => {
  if (!kvData.finalized) return "participant-state-not-finalized";
  if (kvData.contactSheetKey) return "contact-sheet-already-generated";
  if (kvData.expectedCount === 1) return "single-photo-participant";
  return undefined;
};

export const isSupportedContactSheetPhotoCount = (photoCount: number) =>
  VALID_PHOTO_COUNTS.includes(photoCount);
