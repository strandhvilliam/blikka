import { Schema } from "effect";

import { ADMIN_REPLACE_CONTENT_TYPES } from "./replace-submission";

export const BeginAdminReplaceUploadInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    submissionId: Schema.Number,
    contentType: Schema.Literals(ADMIN_REPLACE_CONTENT_TYPES),
  }),
);

export const CompleteAdminReplaceUploadInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    submissionId: Schema.Number,
    newKey: Schema.String,
    previousKey: Schema.String,
  }),
);

export const RegenerateSubmissionAssetsInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    submissionId: Schema.Number,
    regenerateExif: Schema.Boolean,
    regenerateThumbnail: Schema.Boolean,
    rerunValidations: Schema.Boolean,
  }),
);
