import { Schema } from "effect";

import { ADMIN_REPLACE_CONTENT_TYPES } from "./replace-submission";

export const BeginAdminReplaceUploadInputSchema = Schema.Struct({
    domain: Schema.String,
    submissionId: Schema.Number,
    contentType: Schema.Literals(ADMIN_REPLACE_CONTENT_TYPES),
  });

export const CompleteAdminReplaceUploadInputSchema = Schema.Struct({
    domain: Schema.String,
    submissionId: Schema.Number,
    newKey: Schema.String,
    previousKey: Schema.String,
  });

export const RegenerateSubmissionAssetsInputSchema = Schema.Struct({
    domain: Schema.String,
    submissionId: Schema.Number,
    regenerateExif: Schema.Boolean,
    regenerateThumbnail: Schema.Boolean,
    rerunValidations: Schema.Boolean,
  });

export type BeginAdminReplaceUploadInput = Schema.Schema.Type<typeof BeginAdminReplaceUploadInputSchema>
export type CompleteAdminReplaceUploadInput = Schema.Schema.Type<typeof CompleteAdminReplaceUploadInputSchema>
export type RegenerateSubmissionAssetsInput = Schema.Schema.Type<typeof RegenerateSubmissionAssetsInputSchema>

export type BeginAdminReplaceUploadServiceInput = BeginAdminReplaceUploadInput & {
  isAdminForDomain: boolean;
};

export type CompleteAdminReplaceUploadServiceInput = CompleteAdminReplaceUploadInput & {
  isAdminForDomain: boolean;
};

export type RegenerateSubmissionAssetsServiceInput = RegenerateSubmissionAssetsInput & {
  isAdminForDomain: boolean;
};
