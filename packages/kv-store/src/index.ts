import { Effect } from "effect"
import { UploadSessionRepository } from "./repos/upload-session-repository"
import { ZipKVRepository } from "./repos/zip-kv-repository"
import { ExifKVRepository } from "./repos/exif-kv-repository"

export * from "./repos/upload-session-repository"
export * from "./repos/zip-kv-repository"
export * from "./repos/exif-kv-repository"
export * from "./key-factory"
export * from "./schema"

export class KVStore extends Effect.Service<KVStore>()("@blikka/packages/kv-store", {
  dependencies: [
    UploadSessionRepository.Default,
    ZipKVRepository.Default,
    ExifKVRepository.Default,
  ],
  effect: Effect.gen(function* () {
    const uploadRepository = yield* UploadSessionRepository
    const zipRepository = yield* ZipKVRepository
    const exifRepository = yield* ExifKVRepository

    return {
      uploadRepository,
      zipRepository,
      exifRepository,
    }
  }),
}) {}
