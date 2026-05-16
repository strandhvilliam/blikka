import "server-only";

import { Config, Effect, Layer, Option, Context } from "effect";
import {
  DbLayer,
  MarathonsRepository,
  SponsorsRepository,
  type NewSponsor,
} from "@blikka/db";
import { S3Service } from "@blikka/aws";
import { SponsorsApiError } from "./schemas";

export class SponsorsApiService extends Context.Service<SponsorsApiService>()(
  "@blikka/api/sponsors-api-service",
  {
    make: Effect.gen(function* () {
      const sponsorsRepository = yield* SponsorsRepository;
      const marathonsRepository = yield* MarathonsRepository;
      const s3 = yield* S3Service;

      const getSponsorsByMarathon = Effect.fn(
        "SponsorsApiService.getSponsorsByMarathon",
      )(function* ({ domain }: { domain: string }) {
        const marathon = yield* marathonsRepository.getMarathonByDomain({
          domain,
        });

        if (Option.isNone(marathon)) {
          return yield* Effect.fail(
            new SponsorsApiError({
              message: `Marathon not found for domain ${domain}`,
            }),
          );
        }

        return yield* sponsorsRepository.getSponsorsByMarathonId({
          marathonId: marathon.value.id,
        });
      });

      const createSponsor = Effect.fn("SponsorsApiService.createSponsor")(
        function* ({
          domain,
          type,
          position,
          key,
        }: {
          domain: string;
          type:
            | "contact-sheets"
            | "live-landing"
            | "live-success-1"
            | "live-success-2";
          position: "bottom-right" | "bottom-left" | "top-right" | "top-left";
          key: string;
        }) {
          const marathon = yield* marathonsRepository.getMarathonByDomain({
            domain,
          });

          if (Option.isNone(marathon)) {
            return yield* Effect.fail(
              new SponsorsApiError({
                message: `Marathon not found for domain ${domain}`,
              }),
            );
          }

          return yield* sponsorsRepository.createSponsor({
            data: {
              marathonId: marathon.value.id,
              type,
              position,
              key,
            },
          });
        },
      );

      const generateUploadUrl = Effect.fn(
        "SponsorsApiService.generateUploadUrl",
      )(function* ({
        domain,
        type,
        position,
      }: {
        domain: string;
        type:
          | "contact-sheets"
          | "live-landing"
          | "live-success-1"
          | "live-success-2";
        position: "bottom-right" | "bottom-left" | "top-right" | "top-left";
      }) {
        const bucketName = yield* Config.string(
          "MARATHON_SETTINGS_BUCKET_NAME",
        );

        const fileId = crypto.randomUUID();
        const key = `${domain}/sponsors/${fileId}.jpg`;

        const url = yield* s3.getPresignedUrl(bucketName, key, "PUT", {
          expiresIn: 60 * 5,
          contentType: "image/jpeg",
        });

        return { url, key };
      });

      return {
        getSponsorsByMarathon,
        createSponsor,
        generateUploadUrl,
      } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(Layer.mergeAll(DbLayer, S3Service.layer)),
  );
}
