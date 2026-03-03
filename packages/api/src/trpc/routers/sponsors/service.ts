import "server-only"

import { Effect, Option, Config } from "effect"
import { Database, type NewSponsor } from "@blikka/db"
import { S3Service } from "@blikka/s3"
import { SponsorsApiError } from "./schemas"

export class SponsorsApiService extends Effect.Service<SponsorsApiService>()(
  "@blikka/api/sponsors-api-service",
  {
    accessors: true,
    dependencies: [Database.Default, S3Service.Default],
    effect: Effect.gen(function* () {
      const db = yield* Database
      const s3 = yield* S3Service

      const getSponsorsByMarathon = Effect.fn("SponsorsApiService.getSponsorsByMarathon")(
        function* ({ domain }: { domain: string }) {
          const marathon = yield* db.marathonsQueries.getMarathonByDomain({ domain })

          if (Option.isNone(marathon)) {
            return yield* Effect.fail(
              new SponsorsApiError({
                message: `Marathon not found for domain ${domain}`,
              })
            )
          }

          return yield* db.sponsorsQueries.getSponsorsByMarathonId({
            marathonId: marathon.value.id,
          })
        }
      )

      const createSponsor = Effect.fn("SponsorsApiService.createSponsor")(function* ({
        domain,
        type,
        position,
        key,
      }: {
        domain: string
        type: "contact-sheets" | "live-initial-1" | "live-initial-2" | "live-success-1" | "live-success-2"
        position: "bottom-right" | "bottom-left" | "top-right" | "top-left"
        key: string
      }) {
        const marathon = yield* db.marathonsQueries.getMarathonByDomain({ domain })

        if (Option.isNone(marathon)) {
          return yield* Effect.fail(
            new SponsorsApiError({
              message: `Marathon not found for domain ${domain}`,
            })
          )
        }

        return yield* db.sponsorsQueries.createSponsor({
          data: {
            marathonId: marathon.value.id,
            type,
            position,
            key,
          },
        })
      })

      const generateUploadUrl = Effect.fn("SponsorsApiService.generateUploadUrl")(function* ({
        domain,
        type,
        position,
      }: {
        domain: string
        type: "contact-sheets" | "live-initial-1" | "live-initial-2" | "live-success-1" | "live-success-2"
        position: "bottom-right" | "bottom-left" | "top-right" | "top-left"
      }) {
        const bucketName = yield* Config.string("MARATHON_SETTINGS_BUCKET_NAME")

        const fileId = crypto.randomUUID()
        const key = `${domain}/sponsors/${fileId}.jpg`

        const url = yield* s3.getPresignedUrl(bucketName, key, "PUT", {
          expiresIn: 60 * 5,
          contentType: "image/jpeg",
        })

        return { url, key }
      })

      return {
        getSponsorsByMarathon,
        createSponsor,
        generateUploadUrl,
      } as const
    }),
  }
) { }
