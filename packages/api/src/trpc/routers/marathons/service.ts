import "server-only"

import { Effect, Result, Option, Config, ServiceMap, Layer } from "effect"
import { Database, type NewMarathon } from "@blikka/db"
import { S3Service } from "@blikka/aws"
import { ContactSheetBuilder, SharpImageService } from "@blikka/image-manipulation"
import { MarathonApiError } from "./schemas"
import { RULE_KEYS } from "@blikka/validation"
import { JuryApiService } from "../jury/service"
import { getSeedScenarioStatus, seedFinishedScenario } from "./seed-service"

function encodeS3ObjectKeyForUrl(key: string) {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
}

function extractLogoVersion(currentKey?: string | null) {
  if (!currentKey) return undefined

  try {
    const url = new URL(currentKey)
    const decodedPath = decodeURIComponent(url.pathname)
    return decodedPath.split("?")[1]?.split("=")[1]
  } catch {
    return currentKey.split("?")[1]?.split("=")[1]
  }
}

export class MarathonApiService extends ServiceMap.Service<MarathonApiService>()(
  "@blikka/api/MarathonApiService",
  {
    make: Effect.gen(function* () {
      const db = yield* Database
      const s3 = yield* S3Service

      const getMarathonByDomain = Effect.fn("MarathonApiService.getMarathonByDomain")(function* ({
        domain,
      }) {
        const marathon = yield* db.marathonsQueries.getMarathonByDomainWithOptions({ domain })
        const result = yield* Option.match(marathon, {
          onSome: (m) => Effect.succeed(m),
          onNone: () =>
            Effect.fail(
              new MarathonApiError({
                message: `Marathon not found for domain ${domain}`,
              })
            ),
        })

        if (result.mode === 'by-camera' && result.competitionClasses.length === 0) {
          yield* db.competitionClassesQueries.createCompetitionClass({
            data: {
              name: "Default",
              numberOfPhotos: 1,
              marathonId: result.id,
              description: "Default competition class for by-camera competitions",
            },
          })
        }

        return result
      })

      const getUserMarathons = Effect.fn("MarathonApiService.getUserMarathons")(function* ({
        userId,
      }) {
        return yield* db.usersQueries.getMarathonsByUserId({ userId })
      })

      const updateMarathon = Effect.fn("MarathonApiService.updateMarathon")(function* ({
        domain,
        data,
      }: {
        domain: string
        data: Partial<NewMarathon>
      }) {
        const updateData = {
          ...data,
          updatedAt: new Date().toISOString(),
        } satisfies Partial<NewMarathon>

        const result = yield* db.marathonsQueries.updateMarathonByDomain({
          domain,
          data: updateData,
        })

        if (data.startDate !== undefined || data.endDate !== undefined) {
          const rules = yield* db.rulesQueries.getRulesByDomain({ domain })
          const withinTimerangeRule = rules.find(
            (rule) => rule.ruleKey === RULE_KEYS.WITHIN_TIMERANGE
          )

          if (withinTimerangeRule) {
            const marathonAfterUpdate = yield* db.marathonsQueries.getMarathonByDomain({
              domain,
            })
            const finalMarathon = yield* Option.match(marathonAfterUpdate, {
              onSome: (m) => Effect.succeed(m),
              onNone: () =>
                Effect.fail(
                  new MarathonApiError({
                    message: `Marathon not found after update for domain ${domain}`,
                  })
                ),
            })

            yield* db.rulesQueries.updateRuleConfig({
              id: withinTimerangeRule.id,
              data: {
                params: {
                  start: finalMarathon.startDate,
                  end: finalMarathon.endDate,
                },
              },
            })
          }
        }

        return result
      })

      const resetMarathon = Effect.fn("MarathonApiService.resetMarathon")(function* ({
        domain,
      }: {
        domain: string
      }) {
        const marathonId = yield* db.marathonsQueries.getMarathonByDomain({ domain }).pipe(
          Effect.andThen(
            Option.match({
              onSome: (m) => Effect.succeed(m.id),
              onNone: () =>
                Effect.fail(
                  new MarathonApiError({
                    message: `Marathon not found for domain ${domain}`,
                  })
                ),
            })
          )
        )

        return yield* db.marathonsQueries.resetMarathon({ id: marathonId })
      })

      const getLogoUploadUrl = Effect.fn("MarathonApiService.getLogoUploadUrl")(function* ({
        domain,
        currentKey,
      }: {
        domain: string
        currentKey?: string | null
      }) {
        const bucketName = yield* Config.string("MARATHON_SETTINGS_BUCKET_NAME")

        const version = extractLogoVersion(currentKey)
        const newVersion = version ? parseInt(version) + 1 : 1

        const key = `${domain}/logo?v=${newVersion}`
        const url = yield* s3.getPresignedUrl(bucketName, key, "PUT", {
          expiresIn: 60 * 5,
        })

        const publicUrl = `https://${bucketName}.s3.eu-north-1.amazonaws.com/${encodeS3ObjectKeyForUrl(key)}`

        return { url, key, publicUrl }
      })

      const getTermsUploadUrl = Effect.fn("MarathonApiService.getTermsUploadUrl")(function* ({
        domain,
      }: {
        domain: string
      }) {
        const bucketName = yield* Config.string("MARATHON_SETTINGS_BUCKET_NAME")

        const key = `${domain}/terms-and-conditions.txt`
        const url = yield* s3.getPresignedUrl(bucketName, key, "PUT", {
          expiresIn: 60 * 5,
          contentType: "text/plain",
        })

        return { url, key }
      })

      const getCurrentTerms = Effect.fn("MarathonApiService.getCurrentTerms")(function* ({
        domain,
      }: {
        domain: string
      }) {
        const bucketName = yield* Config.string("MARATHON_SETTINGS_BUCKET_NAME")

        const key = `${domain}/terms-and-conditions.txt`
        const fileDataEither = yield* Effect.result(s3.getFile(bucketName, key))

        if (Result.isFailure(fileDataEither)) {
          return yield* Effect.succeed("")
        }

        return yield* Option.match(fileDataEither.success, {
          onSome: (data) => {
            const decoder = new TextDecoder()
            return Effect.succeed(decoder.decode(data))
          },
          onNone: () => Effect.succeed(""),
        })
      })

      const getSeedScenarioStatusForDomain = Effect.fn(
        "MarathonApiService.getSeedScenarioStatusForDomain",
      )(function* ({
        domain,
        isAdminForDomain,
      }: {
        domain: string
        isAdminForDomain: boolean
      }) {
        return yield* getSeedScenarioStatus({
          domain,
          isAdminForDomain,
        })
      })

      const seedFinishedScenarioForDomain = Effect.fn(
        "MarathonApiService.seedFinishedScenarioForDomain",
      )(function* ({
        domain,
        isAdminForDomain,
      }: {
        domain: string
        isAdminForDomain: boolean
      }) {
        return yield* seedFinishedScenario({
          domain,
          isAdminForDomain,
        })
      })

      return {
        getMarathonByDomain,
        getUserMarathons,
        updateMarathon,
        resetMarathon,
        getLogoUploadUrl,
        getTermsUploadUrl,
        getCurrentTerms,
        getSeedScenarioStatusForDomain,
        seedFinishedScenarioForDomain,
      } as const
    }),
  }
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(Layer.mergeAll(
      Database.layer,
      S3Service.layer,
      SharpImageService.layer,
      ContactSheetBuilder.layer,
      JuryApiService.layer,
    ))
  )
}
