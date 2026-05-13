import {
  Config,
  DateTime,
  Effect,
  Layer,
  Option,
  Schema,
  ServiceMap,
} from "effect";
import { Database } from "@blikka/db";
import type { CompetitionClass } from "@blikka/db";
import { S3Service } from "@blikka/aws";
import {
  isCurrentUploadSession,
  UploadSessionRepository,
} from "@blikka/kv-store";
import { ContactSheetBuilder } from "@blikka/image-manipulation";
import {
  generateContactSheetKey,
  getContactSheetSkipReason,
  isSupportedContactSheetPhotoCount,
} from "./contact-sheet-rules";

export interface ContactSheetGeneratorConfigShape {
  readonly contactSheetsBucketName: string;
}

export class ContactSheetGeneratorConfig extends ServiceMap.Service<ContactSheetGeneratorConfig>()(
  "@blikka/uploads/ContactSheetGeneratorConfig",
  {
    make: Effect.gen(function* () {
      const contactSheetsBucketName = yield* Config.string(
        "CONTACT_SHEETS_BUCKET_NAME",
      );
      return { contactSheetsBucketName } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}

export class InvalidSheetGenerationData extends Schema.TaggedErrorClass<InvalidSheetGenerationData>()(
  "InvalidSheetGenerationData",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export const validatePhotoCount = Effect.fnUntraced(function* (
  reference: string,
  keys: string[],
  competitionClass: CompetitionClass | null,
) {
  if (!competitionClass?.numberOfPhotos) {
    return yield* new InvalidSheetGenerationData({
      message: "Missing competition class photo count",
    });
  }

  const expectedCount = competitionClass.numberOfPhotos;
  if (!isSupportedContactSheetPhotoCount(expectedCount)) {
    return yield* new InvalidSheetGenerationData({
      message: `Unsupported photo count ${expectedCount} for participant ${reference}`,
    });
  }

  if (keys.length !== expectedCount) {
    return yield* new InvalidSheetGenerationData({
      message: `Photo count mismatch. Expected ${expectedCount}, got ${keys.length}`,
    });
  }
});

export interface GenerateContactSheetParams {
  domain: string;
  reference: string;
  uploadSessionId: string;
}

export const generateContactSheet = Effect.fn(
  "ContactSheetGenerator.generateContactSheet",
)(function* (params: GenerateContactSheetParams) {
  const db = yield* Database;
  const kvStore = yield* UploadSessionRepository;
  const s3 = yield* S3Service;
  const config = yield* ContactSheetGeneratorConfig;
  const contactSheetBuilder = yield* ContactSheetBuilder;

  return yield* Effect.gen(function* () {
    const participantState = yield* kvStore
      .getParticipantState(params.domain, params.reference)
      .pipe(
        Effect.andThen(
          Option.match({
            onSome: (participantState) => Effect.succeed(participantState),
            onNone: () =>
              Effect.fail(
                new InvalidSheetGenerationData({
                  message: "Participant state not found",
                }),
              ),
          }),
        ),
      );

    const skipReason = getContactSheetSkipReason(participantState);
    if (skipReason) {
      return yield* Effect.logInfo("Skipping contact sheet generation", {
        reason: skipReason,
      });
    }

    const participant = yield* db.participantsQueries
      .getParticipantByReference({
        reference: params.reference,
        domain: params.domain,
      })
      .pipe(
        Effect.andThen(
          Option.match({
            onSome: (participant) => Effect.succeed(participant),
            onNone: () =>
              Effect.fail(
                new InvalidSheetGenerationData({
                  message: "Participant not found",
                }),
              ),
          }),
        ),
      );

    const sessionGuard = isCurrentUploadSession({
      eventUploadSessionId: params.uploadSessionId,
      participantState,
    });
    if (!sessionGuard.matched) {
      yield* Effect.logWarning(
        "Dropping contact sheet event for non-current upload session",
        {
          reason: sessionGuard.reason,
          uploadSessionId: params.uploadSessionId,
        },
      );
      return;
    }

    const sponsor = yield* db.sponsorsQueries.getLatestSponsorByType({
      marathonId: participant.marathonId,
      type: "contact-sheets",
    });

    const topics = yield* db.topicsQueries
      .getTopicsByDomain({ domain: params.domain })
      .pipe(
        Effect.map((topics) =>
          topics.flatMap((topic) => ({
            name: topic.name,
            orderIndex: topic.orderIndex,
          })),
        ),
      );

    const keys = participant.submissions.map((submission) => submission.key);
    yield* validatePhotoCount(
      params.reference,
      keys,
      participant.competitionClass,
    );

    const timestamp = DateTime.formatIso(yield* DateTime.now);
    const contactSheetKey = generateContactSheetKey(
      params.domain,
      params.reference,
      timestamp,
    );

    yield* contactSheetBuilder
      .createSheet({
        domain: params.domain,
        reference: params.reference,
        keys,
        sponsorKey: Option.isSome(sponsor) ? sponsor.value.key : undefined,
        sponsorPosition: "bottom-right",
        topics,
      })
      .pipe(
        Effect.andThen((buffer) =>
          s3.putFile(config.contactSheetsBucketName, contactSheetKey, buffer),
        ),
      );

    yield* Effect.all(
      [
        kvStore.updateParticipantSession(params.domain, params.reference, {
          contactSheetKey,
        }),
        db.contactSheetsQueries.save({
          data: {
            key: contactSheetKey,
            participantId: participant.id,
            marathonId: participant.marathonId,
          },
        }),
      ],
      { concurrency: 2 },
    );
  }).pipe(
    Effect.annotateLogs({ domain: params.domain, reference: params.reference }),
  );
});

export const ContactSheetGeneratorLive = Layer.mergeAll(
  Database.layer,
  ContactSheetGeneratorConfig.layer,
  UploadSessionRepository.layer,
  S3Service.layer,
  ContactSheetBuilder.layer,
);
