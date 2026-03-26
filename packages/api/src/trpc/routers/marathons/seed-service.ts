import {
  type SponsorPosition,
  ContactSheetBuilder,
} from "@blikka/image-manipulation";
import { SharpImageService } from "@blikka/image-manipulation/sharp";
import { S3Service } from "@blikka/aws";
import { RULE_KEYS } from "@blikka/validation";
import {
  Database,
  type CompetitionClass,
  type DeviceGroup,
  type NewParticipant,
  type NewSubmission,
  type NewTopic,
  type NewVotingRoundVote,
  type Participant,
  type Topic,
} from "@blikka/db";
import { Effect, Option } from "effect";
import { JuryApiService } from "../jury/service";
import { MarathonApiError } from "./schemas";
import {
  getSeedParticipantNames,
  getSeedReference,
  SEED_COMBOS,
  SEED_JURY_INVITATIONS,
  SEED_PREVIEW,
  SEED_TOPIC_NAMES,
  SEED_VERIFIED_PARTICIPANT_COUNT,
  SEED_VOTED_SESSION_COUNT,
  SEED_VOTE_OFFSET,
} from "./seed-data";

const ORIGINAL_IMAGE_WIDTH = 1600;
const ORIGINAL_IMAGE_HEIGHT = 1200;
const PREVIEW_WIDTH = 1280;
const THUMBNAIL_WIDTH = 512;
const CONTACT_SHEET_SPONSOR_POSITION: SponsorPosition = "bottom-right";

type SeedMode = "marathon" | "by-camera";

type SeedParticipantRecord = Participant & {
  comboKey: (typeof SEED_COMBOS)[number]["key"];
  competitionClass: CompetitionClass;
  deviceGroup: DeviceGroup;
};

type SubmissionSeedPlan = {
  key: string;
  previewKey: string;
  thumbnailKey: string;
  fileSize: number;
  mimeType: "image/jpeg";
  exif: ReturnType<typeof buildSubmissionExif>;
  topic: Topic;
  participant: SeedParticipantRecord;
  createdAt: string;
};

type SeedStaffMember = {
  userId: string;
  name: string;
};

type SeedSubmissionRecord = {
  id: number;
  participantId: number;
  topicId: number;
};

function getEnvironment() {
  return process.env.NODE_ENV ?? "development";
}

function formatOrderIndex(orderIndex: number) {
  return (orderIndex + 1).toString().padStart(2, "0");
}

function buildSubmissionKey(
  domain: string,
  reference: string,
  orderIndex: number,
  variant: string,
) {
  return `${domain}/__seed/${reference}/${formatOrderIndex(orderIndex)}/${variant}.jpg`;
}

function buildContactSheetKey(domain: string, reference: string) {
  return `${domain}/__seed/${reference}/contact-sheet.jpg`;
}

function formatSeedDate(date: string) {
  return new Date(date).toISOString().replace("T", " ").slice(0, 16);
}

function isGeneralValidationRule(ruleKey: string) {
  return (
    ruleKey === RULE_KEYS.STRICT_TIMESTAMP_ORDERING ||
    ruleKey === RULE_KEYS.SAME_DEVICE
  );
}

function buildSeedValidationMessage({
  ruleKey,
  outcome,
  severity,
  plan,
  startDate,
  endDate,
}: {
  ruleKey: string;
  outcome: "passed" | "failed";
  severity: string;
  plan: SubmissionSeedPlan | null;
  startDate: string;
  endDate: string;
}) {
  const stateLabel =
    outcome === "passed"
      ? "Passed"
      : severity === "warning"
        ? "Warning"
        : "Error";
  const topicLabel = plan
    ? `topic ${plan.topic.orderIndex + 1} (${plan.topic.name})`
    : "submission set";

  switch (ruleKey) {
    case RULE_KEYS.MAX_FILE_SIZE:
      return `${stateLabel}: seeded size review for ${topicLabel}.`;
    case RULE_KEYS.ALLOWED_FILE_TYPES:
      return `${stateLabel}: seeded file type review for ${topicLabel}.`;
    case RULE_KEYS.WITHIN_TIMERANGE:
      return `${stateLabel}: seeded timeframe review for ${topicLabel} against ${formatSeedDate(startDate)} - ${formatSeedDate(endDate)}.`;
    case RULE_KEYS.STRICT_TIMESTAMP_ORDERING:
      return `${stateLabel}: seeded timestamp ordering review for the participant submission set.`;
    case RULE_KEYS.SAME_DEVICE:
      return `${stateLabel}: seeded device consistency review for the participant submission set.`;
    case RULE_KEYS.MODIFIED:
      return `${stateLabel}: seeded post-processing review for ${topicLabel}.`;
    default:
      return `${stateLabel}: seeded validation review for ${topicLabel}.`;
  }
}

function buildSeedValidationResultKey(
  ruleKey: string,
  fileName: string | null,
) {
  return fileName ? `${ruleKey}:${fileName}` : `${ruleKey}:__general__`;
}

function getModeWindow(mode: SeedMode, now: Date) {
  if (mode === "marathon") {
    return {
      startDate: new Date(now.getTime() - 72 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() - 48 * 60 * 60 * 1000),
    };
  }

  return {
    startDate: new Date(now.getTime() - 8 * 60 * 60 * 1000),
    endDate: new Date(now.getTime() - 3 * 60 * 60 * 1000),
  };
}

function getTopicTimestamps(mode: SeedMode, now: Date, index: number) {
  if (mode === "marathon") {
    const start = new Date(
      now.getTime() - 72 * 60 * 60 * 1000 + index * 60 * 60 * 1000,
    );
    return {
      scheduledStart: start.toISOString(),
      activatedAt: start.toISOString(),
    };
  }

  const activatedAt = new Date(now.getTime() - (24 - index) * 20 * 60 * 1000);
  return {
    scheduledStart: activatedAt.toISOString(),
    activatedAt: activatedAt.toISOString(),
  };
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildPlaceholderSvg({
  topic,
  participant,
  reference,
  competitionClassName,
  deviceGroupName,
  mode,
}: {
  topic: Topic;
  participant: SeedParticipantRecord;
  reference: string;
  competitionClassName: string;
  deviceGroupName: string;
  mode: SeedMode;
}) {
  const leftColor =
    participant.deviceGroup.icon === "smartphone" ? "#214A3E" : "#2F3E73";
  const rightColor =
    competitionClassName === "8 Images" ? "#E87C4C" : "#A33C5A";

  return `
    <svg width="${ORIGINAL_IMAGE_WIDTH}" height="${ORIGINAL_IMAGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${leftColor}" />
          <stop offset="100%" stop-color="${rightColor}" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)" />
      <rect x="52" y="52" width="${ORIGINAL_IMAGE_WIDTH - 104}" height="${ORIGINAL_IMAGE_HEIGHT - 104}" rx="36" fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.3)" />
      <text x="88" y="138" font-family="Arial, sans-serif" font-size="38" fill="#F4EFE7" font-weight="700">${escapeXml(
        mode === "marathon"
          ? "Finished Marathon Seed"
          : "Voting In Progress Seed",
      )}</text>
      <text x="88" y="242" font-family="Arial, sans-serif" font-size="112" fill="#FFFFFF" font-weight="800">${escapeXml(
        topic.name,
      )}</text>
      <text x="88" y="308" font-family="Arial, sans-serif" font-size="42" fill="rgba(255,255,255,0.86)">Topic ${topic.orderIndex + 1}</text>
      <text x="88" y="498" font-family="Arial, sans-serif" font-size="58" fill="#FFFFFF" font-weight="700">Participant #${escapeXml(
        reference,
      )}</text>
      <text x="88" y="566" font-family="Arial, sans-serif" font-size="38" fill="rgba(255,255,255,0.88)">${escapeXml(
        `${participant.firstname} ${participant.lastname}`,
      )}</text>
      <text x="88" y="698" font-family="Arial, sans-serif" font-size="34" fill="#F4EFE7" font-weight="600">${escapeXml(
        competitionClassName,
      )}</text>
      <text x="88" y="748" font-family="Arial, sans-serif" font-size="34" fill="#F4EFE7" font-weight="600">${escapeXml(
        deviceGroupName,
      )}</text>
    </svg>
  `.trim();
}

const buildSubmissionAssets = Effect.fn("SeedService.buildSubmissionAssets")(
  function* ({
    topic,
    participant,
    mode,
  }: {
    topic: Topic;
    participant: SeedParticipantRecord;
    mode: SeedMode;
  }) {
    const sharp = yield* SharpImageService;
    const svg = buildPlaceholderSvg({
      topic,
      participant,
      reference: participant.reference,
      competitionClassName: participant.competitionClass.name,
      deviceGroupName: participant.deviceGroup.name,
      mode,
    });

    const original = yield* sharp.createCanvasSheet({
      width: ORIGINAL_IMAGE_WIDTH,
      height: ORIGINAL_IMAGE_HEIGHT,
      background: "#101828",
      items: [
        {
          input: Buffer.from(svg),
          top: 0,
          left: 0,
        },
      ],
    });

    const preview = yield* sharp.resize(original, {
      width: PREVIEW_WIDTH,
    });
    const thumbnail = yield* sharp.resize(original, {
      width: THUMBNAIL_WIDTH,
    });

    return {
      original,
      preview,
      thumbnail,
    };
  },
);

function buildSubmissionExif({
  topic,
  participant,
  createdAt,
}: {
  topic: Topic;
  participant: SeedParticipantRecord;
  createdAt: string;
}) {
  const isMobile = participant.deviceGroup.icon === "smartphone";

  return {
    Make: isMobile ? "SeedPhone" : "SeedCam",
    Model: isMobile ? "SeedPhone One" : "SeedCam X100",
    LensModel: isMobile ? "Built-In Lens" : "50mm F1.8",
    ISO: isMobile ? 320 : 200,
    FNumber: isMobile ? 1.8 : 4,
    ExposureTime: isMobile ? "1/60" : "1/250",
    DateTimeOriginal: createdAt,
    TopicName: topic.name,
  };
}

function buildSubmissionCreatedAt({
  topic,
  participantIndex,
  mode,
  now,
}: {
  topic: Topic;
  participantIndex: number;
  mode: SeedMode;
  now: Date;
}) {
  if (mode === "marathon") {
    return new Date(
      now.getTime() -
        72 * 60 * 60 * 1000 +
        topic.orderIndex * 60 * 60 * 1000 +
        participantIndex * 2 * 60 * 1000,
    );
  }

  return new Date(now.getTime() - (participantIndex + 1) * 4 * 60 * 1000);
}

const getSortedStaffMembers = Effect.fn("SeedService.getSortedStaffMembers")(
  function* ({ domain }: { domain: string }) {
    const db = yield* Database;
    const staffMembers = yield* db.usersQueries.getStaffMembersByDomain({
      domain,
    });

    return staffMembers
      .filter(
        (
          staffMember,
        ): staffMember is Extract<
          (typeof staffMembers)[number],
          { kind: "active" }
        > => staffMember.kind === "active" && staffMember.role === "staff",
      )
      .toSorted((left, right) => {
        const nameCompare = left.name.localeCompare(right.name);
        if (nameCompare !== 0) {
          return nameCompare;
        }
        return left.userId.localeCompare(right.userId);
      });
  },
);

const getMarathonOrFail = Effect.fn("SeedService.getMarathonOrFail")(
  function* ({ domain }: { domain: string }) {
    const db = yield* Database;
    const marathon = yield* db.marathonsQueries.getMarathonByDomain({ domain });

    return yield* Option.match(marathon, {
      onSome: Effect.succeed,
      onNone: () =>
        Effect.fail(
          new MarathonApiError({
            message: `Marathon not found for domain ${domain}`,
          }),
        ),
    });
  },
);

export const getSeedScenarioStatus = Effect.fn(
  "SeedService.getSeedScenarioStatus",
)(function* ({
  domain,
  isAdminForDomain,
}: {
  domain: string;
  isAdminForDomain: boolean;
}) {
  const environment = getEnvironment();
  const marathon = yield* getMarathonOrFail({ domain });
  const staffMembers = yield* getSortedStaffMembers({ domain });
  const blockers: string[] = [];

  if (environment === "production") {
    blockers.push("Seed demo data is disabled in production.");
  }

  if (!isAdminForDomain) {
    blockers.push("You need admin access for this domain to run the seeder.");
  }

  if (staffMembers.length === 0) {
    blockers.push("Add at least one staff member before running the seeder.");
  }

  return {
    environment,
    mode: marathon.mode,
    isAdminForDomain,
    staffCount: staffMembers.length,
    blockers,
    canRun: blockers.length === 0,
    preview: { ...SEED_PREVIEW },
  };
});

const createDeviceGroups = Effect.fn("SeedService.createDeviceGroups")(
  function* ({ marathonId }: { marathonId: number }) {
    const db = yield* Database;
    const mobile = yield* db.deviceGroupsQueries.createDeviceGroup({
      data: {
        marathonId,
        name: "Mobile",
        icon: "smartphone",
        description: "Smartphone or tablet devices",
      },
    });
    const camera = yield* db.deviceGroupsQueries.createDeviceGroup({
      data: {
        marathonId,
        name: "Digital Camera",
        icon: "camera",
        description: "All types of digital cameras",
      },
    });

    return {
      Mobile: mobile,
      "Digital Camera": camera,
    } as const;
  },
);

const createCompetitionClasses = Effect.fn(
  "SeedService.createCompetitionClasses",
)(function* ({ marathonId }: { marathonId: number }) {
  const db = yield* Database;
  const createdClasses =
    yield* db.competitionClassesQueries.createMultipleCompetitionClasses({
      data: [
        {
          marathonId,
          name: "8 Images",
          numberOfPhotos: 8,
          topicStartIndex: 0,
          description: "Seeded eight image competition class",
        },
        {
          marathonId,
          name: "24 Images",
          numberOfPhotos: 24,
          topicStartIndex: 0,
          description: "Seeded twenty four image competition class",
        },
      ],
    });

  const competitionClasses = Object.fromEntries(
    createdClasses.map((competitionClass) => [
      competitionClass.name,
      competitionClass,
    ]),
  ) as Record<string, CompetitionClass>;

  return {
    "8 Images": competitionClasses["8 Images"]!,
    "24 Images": competitionClasses["24 Images"]!,
  } as const;
});

const createTopics = Effect.fn("SeedService.createTopics")(function* ({
  marathonId,
  mode,
  now,
}: {
  marathonId: number;
  mode: SeedMode;
  now: Date;
}) {
  const db = yield* Database;
  const topics = yield* Effect.forEach(
    SEED_TOPIC_NAMES,
    (name, orderIndex) => {
      const timestamps = getTopicTimestamps(mode, now, orderIndex);
      const isActiveByCameraTopic =
        mode === "by-camera" && orderIndex === SEED_TOPIC_NAMES.length - 1;
      const topicData: NewTopic = {
        marathonId,
        name,
        orderIndex,
        visibility: isActiveByCameraTopic ? "active" : "public",
        scheduledStart: timestamps.scheduledStart,
        activatedAt: isActiveByCameraTopic
          ? new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString()
          : timestamps.activatedAt,
      };

      return db.topicsQueries.createTopic({
        data: topicData,
      });
    },
    { concurrency: 1 },
  );

  return topics;
});

const createSeedParticipants = Effect.fn("SeedService.createSeedParticipants")(
  function* ({
    domain,
    marathonId,
    mode,
    competitionClassesByName,
    deviceGroupsByName,
  }: {
    domain: string;
    marathonId: number;
    mode: SeedMode;
    competitionClassesByName: Record<string, CompetitionClass>;
    deviceGroupsByName: Record<string, DeviceGroup>;
  }) {
    const db = yield* Database;

    return yield* Effect.forEach(
      Array.from({ length: SEED_PREVIEW.participants }),
      (_, index) =>
        Effect.gen(function* () {
          const combo = SEED_COMBOS[index % SEED_COMBOS.length]!;
          const names = getSeedParticipantNames(index);
          const competitionClass =
            competitionClassesByName[combo.competitionClassName]!;
          const deviceGroup = deviceGroupsByName[combo.deviceGroupName]!;
          const participantData: NewParticipant = {
            domain,
            marathonId,
            reference: getSeedReference(index),
            firstname: names.firstname,
            lastname: names.lastname,
            email: `seed+${getSeedReference(index)}@example.test`,
            status: "completed",
            participantMode: mode,
            competitionClassId: competitionClass.id,
            deviceGroupId: deviceGroup.id,
            phoneEncrypted: null,
            phoneHash: null,
          };

          const participant = yield* db.participantsQueries.createParticipant({
            data: participantData,
          });

          return {
            ...participant,
            comboKey: combo.key,
            competitionClass,
            deviceGroup,
          } satisfies SeedParticipantRecord;
        }),
      { concurrency: 1 },
    );
  },
);

function getParticipantTopics({
  participant,
  topics,
  mode,
}: {
  participant: SeedParticipantRecord;
  topics: Topic[];
  mode: SeedMode;
}) {
  if (mode === "by-camera") {
    return [topics[topics.length - 1]!];
  }

  return topics.slice(
    participant.competitionClass.topicStartIndex,
    participant.competitionClass.topicStartIndex +
      participant.competitionClass.numberOfPhotos,
  );
}

const uploadSubmissionAssets = Effect.fn("SeedService.uploadSubmissionAssets")(
  function* ({
    domain,
    participant,
    topic,
    createdAt,
  }: {
    domain: string;
    participant: SeedParticipantRecord;
    topic: Topic;
    createdAt: string;
  }) {
    const s3 = yield* S3Service;
    const submissionsBucketName = process.env.SUBMISSIONS_BUCKET_NAME;
    const thumbnailsBucketName = process.env.THUMBNAILS_BUCKET_NAME;

    if (!submissionsBucketName || !thumbnailsBucketName) {
      return yield* Effect.fail(
        new MarathonApiError({
          message: "Missing submissions or thumbnails bucket configuration",
        }),
      );
    }

    const key = buildSubmissionKey(
      domain,
      participant.reference,
      topic.orderIndex,
      "original",
    );
    const previewKey = buildSubmissionKey(
      domain,
      participant.reference,
      topic.orderIndex,
      "preview",
    );
    const thumbnailKey = buildSubmissionKey(
      domain,
      participant.reference,
      topic.orderIndex,
      "thumbnail",
    );

    const { original, preview, thumbnail } = yield* buildSubmissionAssets({
      topic,
      participant,
      mode: participant.participantMode as SeedMode,
    });

    yield* s3.putFile(submissionsBucketName, key, original);
    yield* s3.putFile(submissionsBucketName, previewKey, preview);
    yield* s3.putFile(thumbnailsBucketName, thumbnailKey, thumbnail);

    return {
      key,
      previewKey,
      thumbnailKey,
      fileSize: original.length,
      mimeType: "image/jpeg" as const,
      exif: buildSubmissionExif({
        topic,
        participant,
        createdAt,
      }),
      topic,
      participant,
      createdAt,
    } satisfies SubmissionSeedPlan;
  },
);

const createSeedSubmissions = Effect.fn("SeedService.createSeedSubmissions")(
  function* ({
    domain,
    participants,
    topics,
    mode,
    now,
  }: {
    domain: string;
    participants: SeedParticipantRecord[];
    topics: Topic[];
    mode: SeedMode;
    now: Date;
  }) {
    const db = yield* Database;
    const uploadedPlans = yield* Effect.forEach(
      participants,
      (participant, participantIndex) =>
        Effect.forEach(
          getParticipantTopics({
            participant,
            topics,
            mode,
          }),
          (topic) =>
            uploadSubmissionAssets({
              domain,
              participant,
              topic,
              createdAt: buildSubmissionCreatedAt({
                topic,
                participantIndex,
                mode,
                now,
              }).toISOString(),
            }),
          { concurrency: 2 },
        ).pipe(Effect.map((plans) => plans.flat())),
      { concurrency: 4 },
    ).pipe(Effect.map((plans) => plans.flat()));

    const createdSubmissions =
      yield* db.submissionsQueries.createMultipleSubmissions({
        data: uploadedPlans.map(
          (plan) =>
            ({
              participantId: plan.participant.id,
              marathonId: plan.participant.marathonId,
              topicId: plan.topic.id,
              key: plan.key,
              previewKey: plan.previewKey,
              thumbnailKey: plan.thumbnailKey,
              mimeType: plan.mimeType,
              status: "uploaded",
              exif: plan.exif,
              metadata: {
                seeded: true,
                source: "finished-marathon-seeder",
              },
              createdAt: plan.createdAt,
              updatedAt: plan.createdAt,
            }) satisfies NewSubmission,
        ),
      });

    return {
      plans: uploadedPlans,
      submissions: createdSubmissions,
    };
  },
);

const syncWithinTimerangeRule = Effect.fn(
  "SeedService.syncWithinTimerangeRule",
)(function* ({
  domain,
  startDate,
  endDate,
}: {
  domain: string;
  startDate: string;
  endDate: string;
}) {
  const db = yield* Database;
  const rules = yield* db.rulesQueries.getRulesByDomain({ domain });
  const timerangeRule = rules.find(
    (rule) => rule.ruleKey === RULE_KEYS.WITHIN_TIMERANGE,
  );

  if (!timerangeRule) {
    return rules;
  }

  const updatedRule = yield* db.rulesQueries.updateRuleConfig({
    id: timerangeRule.id,
    data: {
      params: {
        start: startDate,
        end: endDate,
      },
      updatedAt: new Date().toISOString(),
    },
  });

  return rules.map((rule) => (rule.id === updatedRule.id ? updatedRule : rule));
});

const createSeedValidationResults = Effect.fn(
  "SeedService.createSeedValidationResults",
)(function* ({
  domain,
  participants,
  plans,
  rules,
  startDate,
  endDate,
}: {
  domain: string;
  participants: SeedParticipantRecord[];
  plans: SubmissionSeedPlan[];
  rules: Array<{
    id: number;
    ruleKey: string;
    enabled: boolean | null;
    severity: string | null;
  }>;
  startDate: string;
  endDate: string;
}) {
  const db = yield* Database;
  const enabledRules = rules.filter((rule) => rule.enabled);

  if (enabledRules.length === 0) {
    return 0;
  }

  const hasWarningSeverity = enabledRules.some(
    (rule) => rule.severity === "warning",
  );
  const hasErrorSeverity = enabledRules.some(
    (rule) => rule.severity !== "warning",
  );
  const shouldForceMixedSeverities = !hasWarningSeverity || !hasErrorSeverity;

  const plansByParticipantId = new Map<number, SubmissionSeedPlan[]>();
  for (const plan of plans) {
    const existingPlans = plansByParticipantId.get(plan.participant.id) ?? [];
    existingPlans.push(plan);
    plansByParticipantId.set(plan.participant.id, existingPlans);
  }

  const resultsByReference = new Map<
    string,
    Map<
      string,
      {
        outcome: "passed" | "failed";
        ruleKey: string;
        message: string;
        severity: "warning" | "error";
        fileName: string | null;
        overruled: false;
      }
    >
  >();

  participants.forEach((participant) => {
    const participantPlans = (
      plansByParticipantId.get(participant.id) ?? []
    ).toSorted((left, right) => left.topic.orderIndex - right.topic.orderIndex);
    const participantResults = new Map<
      string,
      {
        outcome: "passed" | "failed";
        ruleKey: string;
        message: string;
        severity: "warning" | "error";
        fileName: string | null;
        overruled: false;
      }
    >();

    enabledRules.forEach((rule) => {
      const severity: "warning" | "error" =
        rule.severity === "warning" ? "warning" : "error";

      if (isGeneralValidationRule(rule.ruleKey)) {
        participantResults.set(
          buildSeedValidationResultKey(rule.ruleKey, null),
          {
            outcome: "passed",
            ruleKey: rule.ruleKey,
            message: buildSeedValidationMessage({
              ruleKey: rule.ruleKey,
              outcome: "passed",
              severity,
              plan: null,
              startDate,
              endDate,
            }),
            severity,
            fileName: null,
            overruled: false,
          },
        );
        return;
      }

      participantPlans.forEach((plan) => {
        participantResults.set(
          buildSeedValidationResultKey(rule.ruleKey, plan.key),
          {
            outcome: "passed",
            ruleKey: rule.ruleKey,
            message: buildSeedValidationMessage({
              ruleKey: rule.ruleKey,
              outcome: "passed",
              severity,
              plan,
              startDate,
              endDate,
            }),
            severity,
            fileName: plan.key,
            overruled: false,
          },
        );
      });
    });

    resultsByReference.set(participant.reference, participantResults);
  });

  enabledRules.forEach((rule, ruleIndex) => {
    const targetedParticipants = participants.filter(
      (_, participantIndex) => (participantIndex + ruleIndex) % 6 === 0,
    );
    const maxTargets = isGeneralValidationRule(rule.ruleKey) ? 2 : 3;

    targetedParticipants
      .slice(0, maxTargets)
      .forEach((participant, targetIndex) => {
        const baseSeverity: "warning" | "error" =
          rule.severity === "warning" ? "warning" : "error";
        const severity: "warning" | "error" =
          shouldForceMixedSeverities && targetIndex % 2 === 1
            ? baseSeverity === "warning"
              ? "error"
              : "warning"
            : baseSeverity;
        const participantPlans = (
          plansByParticipantId.get(participant.id) ?? []
        ).toSorted(
          (left, right) => left.topic.orderIndex - right.topic.orderIndex,
        );
        const targetPlan = isGeneralValidationRule(rule.ruleKey)
          ? null
          : (participantPlans[
              (ruleIndex + targetIndex) % participantPlans.length
            ] ?? null);

        const currentResults = resultsByReference.get(participant.reference);
        if (!currentResults) {
          return;
        }

        currentResults.set(
          buildSeedValidationResultKey(rule.ruleKey, targetPlan?.key ?? null),
          {
            outcome: "failed",
            ruleKey: rule.ruleKey,
            message: buildSeedValidationMessage({
              ruleKey: rule.ruleKey,
              outcome: "failed",
              severity,
              plan: targetPlan,
              startDate,
              endDate,
            }),
            severity,
            fileName: targetPlan?.key ?? null,
            overruled: false,
          },
        );
      });
  });

  const createdCounts = yield* Effect.forEach(
    Array.from(resultsByReference.entries()),
    ([reference, results]) =>
      db.validationsQueries
        .createMultipleValidationResults({
          domain,
          reference,
          data: Array.from(results.values()),
        })
        .pipe(Effect.map((createdResults) => createdResults.length)),
    { concurrency: 4 },
  );

  return createdCounts.reduce((total, count) => total + count, 0);
});

const createParticipantVerifications = Effect.fn(
  "SeedService.createParticipantVerifications",
)(function* ({
  participants,
  staffMembers,
}: {
  participants: SeedParticipantRecord[];
  staffMembers: SeedStaffMember[];
}) {
  const db = yield* Database;
  const verifiedParticipants = participants
    .filter((_, index) => index % 4 !== 3)
    .slice(0, SEED_VERIFIED_PARTICIPANT_COUNT);

  yield* Effect.forEach(
    verifiedParticipants,
    (participant, index) =>
      Effect.gen(function* () {
        const staffMember = staffMembers[index % staffMembers.length]!;
        yield* db.validationsQueries.createParticipantVerification({
          data: {
            participantId: participant.id,
            staffId: staffMember.userId,
            notes: `Seed verification by ${staffMember.name}`,
          },
        });
        yield* db.participantsQueries.updateParticipantById({
          id: participant.id,
          data: {
            status: "verified",
          },
        });
      }),
    { concurrency: 4 },
  );

  return verifiedParticipants.length;
});

const createContactSheets = Effect.fn("SeedService.createContactSheets")(
  function* ({
    domain,
    participants,
    plans,
    topics,
  }: {
    domain: string;
    participants: SeedParticipantRecord[];
    plans: SubmissionSeedPlan[];
    topics: Topic[];
  }) {
    const db = yield* Database;
    const contactSheetBuilder = yield* ContactSheetBuilder;
    const s3 = yield* S3Service;
    const contactSheetsBucketName = process.env.CONTACT_SHEETS_BUCKET_NAME;

    if (!contactSheetsBucketName) {
      return yield* Effect.fail(
        new MarathonApiError({
          message: "Missing contact sheets bucket configuration",
        }),
      );
    }

    yield* Effect.forEach(
      participants,
      (participant) =>
        Effect.gen(function* () {
          const keys = plans
            .filter((plan) => plan.participant.id === participant.id)
            .sort(
              (left, right) => left.topic.orderIndex - right.topic.orderIndex,
            )
            .map((plan) => plan.key);
          const sheetBuffer = yield* contactSheetBuilder.createSheet({
            domain,
            reference: participant.reference,
            keys,
            sponsorPosition: CONTACT_SHEET_SPONSOR_POSITION,
            topics: topics.map((topic) => ({
              name: topic.name,
              orderIndex: topic.orderIndex,
            })),
          });
          const key = buildContactSheetKey(domain, participant.reference);
          yield* s3.putFile(contactSheetsBucketName, key, sheetBuffer);
          yield* db.contactSheetsQueries.save({
            data: {
              key,
              participantId: participant.id,
              marathonId: participant.marathonId,
            },
          });
        }),
      { concurrency: 2 },
    );

    return participants.length;
  },
);

const createJuryInvitationsAndRatings = Effect.fn(
  "SeedService.createJuryInvitationsAndRatings",
)(function* ({
  domain,
  participants,
  now,
}: {
  domain: string;
  participants: SeedParticipantRecord[];
  now: Date;
}) {
  const db = yield* Database;
  let ratingCount = 0;

  const invitations = yield* Effect.forEach(
    SEED_JURY_INVITATIONS,
    (template) =>
      Effect.gen(function* () {
        const representativeParticipant = participants.find(
          (participant) => participant.comboKey === template.comboKey,
        );
        if (!representativeParticipant) {
          return yield* Effect.fail(
            new MarathonApiError({
              message: `Missing participants for jury invitation ${template.comboKey}`,
            }),
          );
        }

        const invitation = yield* JuryApiService.use((juryApiService) =>
          juryApiService.createJuryInvitation({
            domain,
            data: {
              email: template.email,
              displayName: template.displayName,
              inviteType: "class",
              competitionClassId: representativeParticipant.competitionClass.id,
              deviceGroupId: representativeParticipant.deviceGroup.id,
              expiresAt: new Date(
                now.getTime() + 30 * 24 * 60 * 60 * 1000,
              ).toISOString(),
              notes: `Seeded ${template.status} jury invitation`,
              status: template.status,
            },
          }),
        );

        const targetParticipants = participants
          .filter((participant) => participant.comboKey === template.comboKey)
          .toSorted((left, right) =>
            left.reference.localeCompare(right.reference),
          );
        const ratingsToCreate = Math.floor(
          targetParticipants.length * template.progressRatio,
        );
        const ratedParticipants = targetParticipants.slice(0, ratingsToCreate);

        yield* Effect.forEach(
          ratedParticipants,
          (participant, index) =>
            Effect.gen(function* () {
              const rating = 5 - ((index + participant.id) % 5);
              yield* db.juryQueries.createJuryRating({
                invitationId: invitation.id,
                participantId: participant.id,
                rating,
                notes: "Seeded jury rating",
              });
              ratingCount += 1;
            }),
          { concurrency: 4 },
        );

        if (template.status === "completed") {
          const rankingOrder = ratedParticipants
            .map((participant, index) => ({
              participant,
              rating: 5 - ((index + participant.id) % 5),
            }))
            .toSorted((left, right) => {
              if (left.rating !== right.rating) {
                return right.rating - left.rating;
              }
              return left.participant.reference.localeCompare(
                right.participant.reference,
              );
            });

          yield* Effect.forEach(
            rankingOrder,
            ({ participant, rating }, rankingIndex) =>
              Effect.gen(function* () {
                yield* db.juryQueries.updateJuryRating({
                  invitationId: invitation.id,
                  participantId: participant.id,
                  rating,
                  notes: "Seeded jury rating",
                });
                yield* db.juryQueries.createJuryFinalRanking({
                  invitationId: invitation.id,
                  participantId: participant.id,
                  rank: rankingIndex + 1,
                });
              }),
            { concurrency: 4 },
          );
        }

        return invitation;
      }),
    { concurrency: 1 },
  );

  return {
    invitationCount: invitations.length,
    ratingCount,
  };
});

const createVotingSessions = Effect.fn("SeedService.createVotingSessions")(
  function* ({
    participants,
    activeTopic,
    submissions,
    now,
  }: {
    participants: SeedParticipantRecord[];
    activeTopic: Topic;
    submissions: SeedSubmissionRecord[];
    now: Date;
  }) {
    const db = yield* Database;
    const activeTopicSubmissions = submissions
      .filter((submission) => submission.topicId === activeTopic.id)
      .toSorted((left, right) => left.participantId - right.participantId);

    const sessions = participants.map((participant, index) => {
      const isVoted = index < SEED_VOTED_SESSION_COUNT;
      const targetSubmission = isVoted
        ? activeTopicSubmissions[
            (index + SEED_VOTE_OFFSET) % activeTopicSubmissions.length
          ]!
        : null;
      const votedAt = isVoted
        ? new Date(
            now.getTime() - (SEED_VOTED_SESSION_COUNT - index) * 4 * 60 * 1000,
          ).toISOString()
        : null;

      return {
        token: `seed-vote-${participant.reference}-topic-${formatOrderIndex(activeTopic.orderIndex)}`,
        firstName: participant.firstname,
        lastName: participant.lastname,
        email:
          participant.email ?? `seed+${participant.reference}@example.test`,
        phoneHash: null,
        phoneEncrypted: null,
        marathonId: participant.marathonId,
        notificationLastSentAt: new Date(
          now.getTime() - 85 * 60 * 1000,
        ).toISOString(),
        voteSubmissionId: !isVoted
          ? null
          : targetSubmission &&
              targetSubmission.participantId !== participant.id
            ? targetSubmission.id
            : activeTopicSubmissions[
                (index + SEED_VOTE_OFFSET + 1) % activeTopicSubmissions.length
              ]!.id,
        connectedParticipantId: participant.id,
        votedAt,
        topicId: activeTopic.id,
        createdAt: new Date(
          now.getTime() - 90 * 60 * 1000 + index * 60 * 1000,
        ).toISOString(),
        updatedAt:
          votedAt ?? new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
      };
    });

    const createdSessions = yield* db.votingQueries.createVotingSessions({
      sessions,
    });

    const createdRound = yield* db.votingQueries.createVotingRound({
      marathonId: activeTopic.marathonId,
      topicId: activeTopic.id,
      roundNumber: 1,
      kind: "initial",
      sourceRoundId: null,
      startedAt: new Date(now.getTime() - 75 * 60 * 1000).toISOString(),
      endsAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    });

    if (!createdRound) {
      return {
        sessionCount: createdSessions.length,
        voteCount: sessions.filter((session) => session.votedAt).length,
      };
    }

    yield* db.votingQueries.createVotingRoundSubmissions({
      roundId: createdRound.id,
      submissionIds: activeTopicSubmissions.map((submission) => submission.id),
    });

    const roundVotes: NewVotingRoundVote[] = createdSessions.flatMap(
      (session, index) => {
        const seedSession = sessions[index];
        if (!seedSession?.voteSubmissionId || !seedSession.votedAt) {
          return [];
        }

        return [
          {
            roundId: createdRound.id,
            sessionId: session.id,
            submissionId: seedSession.voteSubmissionId,
            votedAt: seedSession.votedAt,
          },
        ];
      },
    );

    yield* db.votingQueries.createVotingRoundVotes({
      votes: roundVotes,
    });

    return {
      sessionCount: createdSessions.length,
      voteCount: sessions.filter((session) => session.votedAt).length,
    };
  },
);

export const seedFinishedScenario = Effect.fn(
  "SeedService.seedFinishedScenario",
)(function* ({
  domain,
  isAdminForDomain,
}: {
  domain: string;
  isAdminForDomain: boolean;
}) {
  const db = yield* Database;
  const marathon = yield* getMarathonOrFail({ domain });
  const mode = marathon.mode as SeedMode;
  const status = yield* getSeedScenarioStatus({
    domain,
    isAdminForDomain,
  });

  if (!status.canRun) {
    return yield* Effect.fail(
      new MarathonApiError({
        message: status.blockers[0] ?? "Seed scenario is not available",
      }),
    );
  }

  const staffMembers = yield* getSortedStaffMembers({ domain });
  const now = new Date();
  const { startDate, endDate } = getModeWindow(mode, now);

  const runSeed = Effect.gen(function* () {
    yield* db.marathonsQueries.clearOperationalSeedableData({
      id: marathon.id,
    });
    yield* db.marathonsQueries.updateMarathonByDomain({
      domain,
      data: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        setupCompleted: true,
      },
    });
    const rules = yield* syncWithinTimerangeRule({
      domain,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    const deviceGroupsByName = yield* createDeviceGroups({
      marathonId: marathon.id,
    });
    const competitionClassesByName = yield* createCompetitionClasses({
      marathonId: marathon.id,
    });
    const topics = yield* createTopics({
      marathonId: marathon.id,
      mode,
      now,
    });
    const participants = yield* createSeedParticipants({
      domain,
      marathonId: marathon.id,
      mode,
      competitionClassesByName,
      deviceGroupsByName,
    });
    const { plans, submissions } = yield* createSeedSubmissions({
      domain,
      participants,
      topics,
      mode,
      now,
    });
    const validationResultsCreated = yield* createSeedValidationResults({
      domain,
      participants,
      plans,
      rules,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    if (mode === "marathon") {
      const participantVerificationsCreated =
        yield* createParticipantVerifications({
          participants,
          staffMembers,
        });
      const contactSheetsCreated = yield* createContactSheets({
        domain,
        participants,
        plans,
        topics,
      });
      const { invitationCount, ratingCount } =
        yield* createJuryInvitationsAndRatings({
          domain,
          participants,
          now,
        });

      return {
        mode,
        participantsCreated: participants.length,
        submissionsCreated: submissions.length,
        participantVerificationsCreated,
        juryInvitationsCreated: invitationCount,
        juryRatingsCreated: ratingCount,
        votingSessionsCreated: 0,
        votesCast: 0,
        contactSheetsCreated,
        validationResultsCreated,
      };
    }

    const activeTopic = topics[topics.length - 1]!;
    const voting = yield* createVotingSessions({
      participants,
      activeTopic,
      submissions,
      now,
    });

    return {
      mode,
      participantsCreated: participants.length,
      submissionsCreated: submissions.length,
      participantVerificationsCreated: 0,
      juryInvitationsCreated: 0,
      juryRatingsCreated: 0,
      votingSessionsCreated: voting.sessionCount,
      votesCast: voting.voteCount,
      contactSheetsCreated: 0,
      validationResultsCreated,
    };
  });

  return yield* runSeed.pipe(
    Effect.catch((error) =>
      db.marathonsQueries
        .clearOperationalSeedableData({
          id: marathon.id,
        })
        .pipe(
          Effect.flatMap(() =>
            db.marathonsQueries.updateMarathonByDomain({
              domain,
              data: {
                startDate: marathon.startDate,
                endDate: marathon.endDate,
                setupCompleted: marathon.setupCompleted,
                updatedAt: new Date().toISOString(),
              },
            }),
          ),
          Effect.catch(() => Effect.void),
          Effect.flatMap(() => Effect.fail(error)),
        ),
    ),
  );
});
