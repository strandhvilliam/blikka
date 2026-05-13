import { Effect, Option, Schema } from "effect";
import {
  DirectUploadMessageSchema,
  S3EventSchema,
} from "./upload-message-schemas";

const BODY_PREVIEW_MAX_LENGTH = 200;

export class UploadMessageJsonParseError extends Schema.TaggedErrorClass<UploadMessageJsonParseError>()(
  "UploadMessageJsonParseError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export class UploadProcessorInvalidMessageError extends Schema.TaggedErrorClass<UploadProcessorInvalidMessageError>()(
  "UploadProcessorInvalidMessageError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
    bodyPreview: Schema.optional(Schema.String),
  },
) {}

const decodeS3ObjectKey = (key: string): string => {
  try {
    return decodeURIComponent(key.replace(/\+/g, " "));
  } catch {
    return key;
  }
};

export const parseUploadMessageJson = (input: string) =>
  Effect.try({
    try: () => JSON.parse(input),
    catch: (cause) =>
      new UploadMessageJsonParseError({
        message: "Failed to parse JSON",
        cause,
      }),
  });

export const parseAndNormalizeUploadMessage = Effect.fnUntraced(function* (
  body: string,
) {
  const parsed = yield* parseUploadMessageJson(body);

  const s3Option = Schema.decodeUnknownOption(S3EventSchema)(parsed);
  if (Option.isSome(s3Option)) {
    return s3Option.value.Records.map((record) => ({
      key: decodeS3ObjectKey(record.s3.object.key),
    }));
  }

  const directOption = Schema.decodeUnknownOption(DirectUploadMessageSchema)(
    parsed,
  );
  if (Option.isSome(directOption)) {
    return directOption.value.submissionKeys.map((key) => ({ key }));
  }

  return yield* new UploadProcessorInvalidMessageError({
    message:
      "Message body is neither S3 event nor direct submissionKeys format",
    bodyPreview: body.slice(0, BODY_PREVIEW_MAX_LENGTH),
  });
});
