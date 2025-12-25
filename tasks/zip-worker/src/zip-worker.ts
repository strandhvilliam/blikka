import { Effect, Option, Schema } from "effect"
import { ZipKVRepository } from "@blikka/kv-store"
import { Database, Submission, Topic } from "@blikka/db"
import { S3Service } from "@blikka/s3"
import { Resource as SSTResource } from "sst"
import path from "path"
import JSZip from "jszip"
import {
  makeNewZipDto,
  InvalidArgumentsError,
  DataNotFoundError,
  FailedToGenerateZipError,
} from "./utils"

export class ZipWorker extends Effect.Service<ZipWorker>()("@blikka/tasks/zip-worker/zip-worker", {
  dependencies: [ZipKVRepository.Default, Database.Default, S3Service.Default],
  effect: Effect.gen(function* () {
    const kvStore = yield* ZipKVRepository
    const db = yield* Database
    const s3 = yield* S3Service

    const buildZipBuffer = Effect.fn("ZipWorker.buildZipBuffer")(function* (
      domain: string,
      reference: string,
      entries: { path: string; data: Uint8Array<ArrayBufferLike> }[]
    ) {
      return yield* Effect.tryPromise({
        try: async () => {
          const zip = new JSZip()
          for (const { path, data } of entries) {
            zip.file(path, data, {
              binary: true,
              compression: "DEFLATE",
            })
          }
          return zip.generateAsync({
            type: "nodebuffer",
            compression: "DEFLATE",
          })
        },
        catch: (error) =>
          new FailedToGenerateZipError({
            message: "Failed to build zip buffer",
            cause: error,
            domain,
            reference,
          }),
      })
    })

    const processSubmission = Effect.fn("ZipWorker.processSubmission")(function* (
      domain: string,
      reference: string,
      submission: Submission,
      topics: Topic[]
    ) {
      const orderIndex = Option.fromNullable(
        topics.find((topic) => topic.id === submission.topicId)?.orderIndex
      )

      if (Option.isNone(orderIndex)) {
        return yield* new DataNotFoundError({
          message: "Topic not found",
          domain,
          reference,
          key: submission.key,
        })
      }

      const paddedOrderIndex = String(orderIndex.value + 1).padStart(2, "0")
      const extension = path.extname(submission.key).slice(1) || "jpg"
      const zipPath = `${reference}_${paddedOrderIndex}.${extension}`

      const buffer = yield* s3.getFile(SSTResource.V2SubmissionsBucket.name, submission.key).pipe(
        Effect.mapError(
          (error) =>
            new FailedToGenerateZipError({
              message: "Failed to get file from s3",
              cause: error,
              domain,
              reference,
            })
        ),
        Effect.andThen(
          Option.match({
            onSome: (file) => Effect.succeed(file),
            onNone: () =>
              Effect.fail(
                new DataNotFoundError({
                  message: "File not found",
                  domain,
                  reference,
                  key: submission.key,
                })
              ),
          })
        )
      )

      return {
        path: zipPath,
        data: buffer,
      }
    })

    const fetchRequiredData = Effect.fn("ZipWorker.fetchRequiredData")(function* (
      domain: string,
      reference: string
    ) {
      const participantOpt = yield* db.participantsQueries.getParticipantByReference({
        reference,
        domain,
      })
      if (Option.isNone(participantOpt)) {
        return yield* new DataNotFoundError({
          message: "Participant not found",
          domain,
          reference,
        })
      }
      const topics = yield* db.topicsQueries.getTopicsByMarathonId({
        id: participantOpt.value.marathonId,
      })

      return {
        participant: participantOpt.value,
        topics,
      }
    })

    const runZipTask = Effect.fn("ZipWorker.runZipTask")(function* (
      domain: string,
      reference: string
    ) {
      yield* kvStore.initializeZipProgress(domain, reference, `${domain}/${reference}.zip`)

      const { participant, topics } = yield* fetchRequiredData(domain, reference)

      const entries = yield* Effect.forEach(
        participant.submissions,
        (submission) =>
          processSubmission(domain, reference, submission, topics).pipe(
            Effect.tap(() => kvStore.incrementZipProgress(domain, reference))
          ),
        { concurrency: 8 }
      )

      const zipBuffer = yield* buildZipBuffer(domain, reference, entries)
      yield* s3.putFile(SSTResource.V2ZipsBucket.name, `${domain}/${reference}.zip`, zipBuffer)

      const zipDto = makeNewZipDto(domain, participant)
      yield* Effect.all(
        [
          kvStore.completeZipProgress(domain, reference).pipe(
            Effect.mapError(
              (error) =>
                new FailedToGenerateZipError({
                  message: "Failed to save zip progress",
                  cause: error,
                  domain,
                  reference,
                })
            )
          ),
          db.submissionsQueries.createZippedSubmission(zipDto).pipe(
            Effect.mapError(
              (error) =>
                new FailedToGenerateZipError({
                  domain,
                  reference,
                  message: "Failed to save zipped submission to db",
                  cause: error,
                })
            )
          ),
        ],
        {
          concurrency: 2,
        }
      )

      return zipBuffer
    })
    return {
      runZipTask,
    } as const
  }),
}) {}
