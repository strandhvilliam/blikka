import { Effect, Option, Schema } from "effect";

export class JsonParseError extends Schema.TaggedErrorClass<JsonParseError>()(
  "JsonParseError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export class InvalidSqsMessageError extends Schema.TaggedErrorClass<InvalidSqsMessageError>()(
  "InvalidSqsMessageError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
    bodyPreview: Schema.optional(Schema.String),
  },
) {}

export class InvalidObjectKeyFormatError extends Schema.TaggedErrorClass<InvalidObjectKeyFormatError>()(
  "InvalidObjectKeyFormatError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

const S3EventSchema = Schema.Struct({
  Records: Schema.Array(
    Schema.Struct({
      s3: Schema.Struct({
        object: Schema.Struct({
          key: Schema.String,
        }),
        bucket: Schema.Struct({
          name: Schema.String,
        }),
      }),
    }),
  ),
});

const DirectSubmissionKeysMessageSchema = Schema.Struct({
  submissionKeys: Schema.Array(Schema.String),
});

export interface NormalizedSqsObjectMessage {
  readonly key: string;
}

export interface ParsedUploadObjectKey {
  readonly domain: string;
  readonly reference: string;
  readonly orderIndex: number;
  readonly fileName: string;
}

export const parseJson = (input: string) =>
  Effect.try({
    try: () => JSON.parse(input),
    catch: (cause) =>
      new JsonParseError({ message: "Failed to parse JSON", cause }),
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

    const directOption = Schema.decodeUnknownOption(
      DirectSubmissionKeysMessageSchema,
    )(parsed);
    if (Option.isSome(directOption)) {
      return directOption.value.submissionKeys.map((key) => ({ key }));
    }

    return yield* Effect.fail(
      new InvalidSqsMessageError({
        message:
          "Message body is neither S3 event nor direct submissionKeys format",
        bodyPreview: body.slice(0, BODY_PREVIEW_MAX_LENGTH),
      }),
    );
  });

export const parseUploadObjectKey = Effect.fn(
  "TaskRuntime.parseUploadObjectKey",
)(function* (key: string) {
  const [domain, reference, formattedOrderIndex, fileName] = key.split("/");
  if (!domain || !reference || !formattedOrderIndex || !fileName) {
    return yield* new InvalidObjectKeyFormatError({
      message: `Missing: domain=${domain}, reference=${reference}, orderIndex=${formattedOrderIndex}, fileName=${fileName}`,
    });
  }

  const orderIndex = Number(formattedOrderIndex) - 1;

  return { domain, reference, orderIndex, fileName };
});
