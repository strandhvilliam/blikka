import { Data, Effect, Either, Option, Schema, Array, String, pipe, DateTime, Order } from "effect"
import { Prompt } from "@effect/cli"
import { Database, SqlError, Topic } from "@blikka/db"
import {
  ParticipantEmailInputSchema,
  ParticipantNameInputSchema,
  ParticipantReferenceInputSchema,
} from "@/schemas"
import {
  FetchHttpClient,
  HttpClientRequest,
  HttpClient,
  Terminal,
  HttpBody,
} from "@effect/platform"
import { QuitException } from "@effect/platform/Terminal"
import { PlatformError } from "@effect/platform/Error"
import { FileSystem } from "@effect/platform"
import { S3Service } from "@blikka/s3"
import { UploadSessionRepository } from "@blikka/kv-store"
import { formatOrderIndex, generateSubmissionKey } from "@/utils"
export class UploadFlowCliService extends Effect.Service<UploadFlowCliService>()(
  "@blikka/cli/upload-flow-service",
  {
    dependencies: [
      Database.Default,
      UploadSessionRepository.Default,
      S3Service.Default,
      FetchHttpClient.layer,
    ],
    effect: Effect.gen(function* () {
      // 1: initialize participant with submissions (both redis and db)
      // 2: get presigned urls
      // 3: upload submissions
      // 4: scheduled check each second for state
      // 5: if completed, exit

      const terminal = yield* Terminal.Terminal
      const db = yield* Database
      const fs = yield* FileSystem.FileSystem
      const s3 = yield* S3Service
      const kv = yield* UploadSessionRepository
      const http = yield* HttpClient.HttpClient

      const promptForUniqueReference: ({
        domain,
      }: {
        domain: string
      }) => Effect.Effect<string, SqlError | QuitException | PlatformError, Terminal.Terminal> =
        Effect.fn("UploadFlowCliService.promptForUniqueReference")(function* ({ domain }) {
          const reference = yield* Prompt.text({
            message: "Enter participant reference:",
            validate: (reference) =>
              Schema.decode(ParticipantReferenceInputSchema)(reference).pipe(
                Effect.mapError((error) => error.message)
              ),
          })

          const exists = yield* db.participantsQueries.getParticipantByReference({
            reference,
            domain,
          })

          if (Option.isSome(exists)) {
            yield* terminal.display("Participant reference already exists\n")
            return yield* promptForUniqueReference({ domain })
          }

          return yield* Effect.succeed(reference)
        })

      const selectFilesForKeys = Effect.fn("UploadFlowCliService.selectFilesForKeys")(function* ({
        keys,
        startingPath,
      }: {
        keys: ReadonlyArray<string>
        startingPath: string
      }) {
        const go = (
          remaining: ReadonlyArray<string>,
          path: string
        ): Effect.Effect<
          ReadonlyArray<string>,
          QuitException | PlatformError,
          Terminal.Terminal
        > => {
          if (remaining.length === 0) return Effect.succeed([])

          const [current, ...rest] = remaining

          return Prompt.file({
            message: `Select file for key: ${current}`,
            startingPath: path,
            filter: (p) => (!p.startsWith(".") ? true : p.startsWith("..")),
          }).pipe(
            Effect.flatMap((file) =>
              go(rest, file.split("/").slice(0, -1).join("/")).pipe(
                Effect.map((files) => [file, ...files])
              )
            )
          )
        }

        return yield* go(keys, startingPath)
      })

      const upload = Effect.fn("UploadFlowCliService.upload")(function* () {
        const marathons = yield* db.marathonsQueries.getMarathons()

        const selectedMarathon = yield* Prompt.select({
          message: "Select marathon:",
          choices: marathons.map((marathon) => ({
            title: marathon.name,
            value: marathon.id,
          })),
        }).pipe(
          Effect.andThen((id) => Array.findFirst(marathons, (marathon) => marathon.id === id))
        )

        const reference = yield* promptForUniqueReference({
          domain: selectedMarathon.domain,
        })

        const firstname = yield* Prompt.text({
          message: "Enter participant firstname:",
          validate: (name) =>
            Schema.decode(ParticipantNameInputSchema)(name).pipe(
              Effect.mapError((error) => error.message)
            ),
        })

        const lastname = yield* Prompt.text({
          message: "Enter participant lastname:",
          validate: (name) =>
            Schema.decode(ParticipantNameInputSchema)(name).pipe(
              Effect.mapError((error) => error.message)
            ),
        })

        const email = yield* Prompt.text({
          message: "Enter participant email:",
          validate: (email) =>
            Schema.decode(ParticipantEmailInputSchema)(email).pipe(
              Effect.mapError(() => "Invalid email format")
            ),
        })

        const selectedClass = yield* Prompt.select({
          message: "Select class:",
          choices: selectedMarathon.competitionClasses.map((c) => ({
            title: `${c.name} (${c.numberOfPhotos})`,
            value: c.id,
          })),
        }).pipe(
          Effect.andThen((id) =>
            Array.findFirst(selectedMarathon.competitionClasses, (c) => c.id === id)
          )
        )

        const participant = yield* db.participantsQueries.createParticipant({
          data: {
            domain: selectedMarathon.domain,
            reference,
            firstname,
            lastname,
            email,
            marathonId: selectedMarathon.id,
            competitionClassId: selectedClass.id,
          },
        })

        const topicsForSubmissions = selectedMarathon.topics.slice(
          selectedClass.topicStartIndex,
          selectedClass.topicStartIndex + selectedClass.numberOfPhotos
        )

        const dbSubmissions = yield* db.submissionsQueries.createMultipleSubmissions({
          data: topicsForSubmissions.map((topic) => ({
            participantId: participant.id,
            key: generateSubmissionKey(selectedMarathon.domain, reference, topic.orderIndex),
            marathonId: selectedMarathon.id,
            topicId: topic.id,
            status: "initialized",
          })),
        })

        const sortByOrderIndex = Order.mapInput(Order.number, (topic: Topic) => topic.orderIndex)

        const keys = yield* db.topicsQueries
          .getTopicsByDomain({
            domain: selectedMarathon.domain,
          })
          .pipe(
            Effect.andThen(Array.sort(sortByOrderIndex)),
            Effect.andThen(Array.drop(selectedClass.topicStartIndex)),
            Effect.andThen(
              Array.map((topic) =>
                generateSubmissionKey(selectedMarathon.domain, reference, topic.orderIndex)
              )
            )
          )

        // const keys = [
        //   generateSubmissionKey("uppis", "9999", 0),
        //   generateSubmissionKey("uppis", "9999", 1),
        // ]

        yield* kv.initializeState(selectedMarathon.domain, reference, keys)

        const presignedUrls = yield* Effect.all(
          keys.map((key) =>
            s3.getPresignedUrl("blikka-development-v2submissionsbucketbucket-xdhbcmna", key, "PUT")
          )
        )

        const filePaths = yield* selectFilesForKeys({
          keys,
          startingPath: `/Users/${process.env.USER}`,
        })

        yield* terminal.display(`Selected files: ${filePaths.join(", ")}\n`)

        for (let i = 0; i < filePaths.length; i++) {
          const key = keys[i]
          const path = filePaths[i]
          const presignedUrl = presignedUrls[i]
          if (!presignedUrl || !path || !key) {
            continue
          }
          const file = yield* fs.readFile(path).pipe(Effect.map((file) => Buffer.from(file)))

          // const httpBody = yield* HttpBody.file(path)

          // const res = http.put(presignedUrl).pipe(httpBody)

          const res = yield* Effect.tryPromise({
            try: () =>
              fetch(presignedUrl, {
                method: "PUT",
                body: file,
                headers: {
                  "Content-Type": "image/jpeg",
                },
              }).then((res) => res.statusText),
            catch: (error) => {
              console.error(error)
              Effect.die(error)
            },
          })

          yield* terminal.display(`Uploaded file for key: ${key}\n`)
        }

        return yield* Effect.succeed(true)
      })

      return {
        upload,
      } as const
    }),
  }
) {}
