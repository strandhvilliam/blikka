import { Schema } from "effect";

export class AdminReplaceSubmissionError extends Schema.TaggedErrorClass<AdminReplaceSubmissionError>()(
  "@blikka/api/AdminReplaceSubmissionError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export const ADMIN_REPLACE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export type AdminReplaceContentType = (typeof ADMIN_REPLACE_CONTENT_TYPES)[number];

export function parseSubmissionStorageKey(key: string) {
  const [domain, reference, formattedOrderIndex, fileName] = key.split("/");

  if (!domain || !reference || !formattedOrderIndex || !fileName) {
    throw new AdminReplaceSubmissionError({
      message: `Invalid submission storage key: ${key}`,
    });
  }

  const orderIndex = Number(formattedOrderIndex) - 1;

  if (!Number.isInteger(orderIndex) || orderIndex < 0) {
    throw new AdminReplaceSubmissionError({
      message: `Invalid submission order index in key: ${key}`,
    });
  }

  return {
    domain,
    reference,
    orderIndex,
    fileName,
  };
}

export function makeThumbnailKey({
  domain,
  reference,
  orderIndex,
  fileName,
}: {
  domain: string;
  reference: string;
  orderIndex: number;
  fileName: string;
}) {
  const formattedOrderIndex = (orderIndex + 1).toString().padStart(2, "0");
  return `${domain}/${reference}/${formattedOrderIndex}/thumbnail_${fileName}`;
}

export function assertReplaceTargetMatchesSubmission({
  parsedKey,
  expectedDomain,
  expectedReference,
  expectedOrderIndex,
}: {
  parsedKey: {
    domain: string;
    reference: string;
    orderIndex: number;
    fileName: string;
  };
  expectedDomain: string;
  expectedReference: string;
  expectedOrderIndex: number;
}) {
  if (
    parsedKey.domain !== expectedDomain ||
    parsedKey.reference !== expectedReference ||
    parsedKey.orderIndex !== expectedOrderIndex
  ) {
    throw new AdminReplaceSubmissionError({
      message: "Replacement upload target does not match submission slot",
    });
  }
}
