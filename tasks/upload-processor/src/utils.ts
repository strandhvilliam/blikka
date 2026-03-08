import { Effect, Option, Schema } from "effect";
import {
  JsonParseError,
  InvalidKeyFormatError,
  InvalidMessageError,
} from "./errors";
import { DirectMessageSchema, S3EventSchema } from "./schemas";

export const parseJson = (input: string) =>
  Effect.try({
    try: () => JSON.parse(input),
    catch: (unknown) => new JsonParseError({ message: "Failed to parse JSON" }),
  });

const BODY_PREVIEW_MAX_LENGTH = 200;

const decodeS3ObjectKey = (key: string): string => {
  try {
    return decodeURIComponent(key.replace(/\+/g, " "));
  } catch {
    return key;
  }
};

export const parseAndNormalizeMessage = (body: string) =>
  Effect.gen(function* () {
    const parsed = yield* parseJson(body);

    const s3Option = Schema.decodeUnknownOption(S3EventSchema)(parsed);
    if (Option.isSome(s3Option)) {
      return s3Option.value.Records.map((record) => ({
        key: decodeS3ObjectKey(record.s3.object.key),
      }));
    }

    const directOption =
      Schema.decodeUnknownOption(DirectMessageSchema)(parsed);
    if (Option.isSome(directOption)) {
      return directOption.value.submissionKeys.map((key) => ({ key }));
    }

    return yield* Effect.fail(
      new InvalidMessageError({
        message:
          "Message body is neither S3 event nor direct submissionKeys format",
        bodyPreview: body.slice(0, BODY_PREVIEW_MAX_LENGTH),
      }),
    );
  });

export const parseKey = Effect.fn("UploadProcessorUtils.parseKey")(function* (
  key: string,
) {
  const [domain, reference, formattedOrderIndex, fileName] = key.split("/");
  if (!domain || !reference || !formattedOrderIndex || !fileName) {
    return yield* new InvalidKeyFormatError({
      message: `Missing: domain=${domain}, reference=${reference}, orderIndex=${formattedOrderIndex}, fileName=${fileName}`,
    });
  }

  const orderIndex = Number(formattedOrderIndex) - 1;

  return { domain, reference, orderIndex, fileName };
});

export const makeThumbnailKey = (params: {
  domain: string;
  reference: string;
  orderIndex: number;
  fileName: string;
}) => {
  const formattedOrderIndex = (params.orderIndex + 1)
    .toString()
    .padStart(2, "0");
  return `${params.domain}/${params.reference}/${formattedOrderIndex}/thumbnail_${params.fileName}`;
};
