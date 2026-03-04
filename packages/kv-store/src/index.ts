import { Effect, Layer, ServiceMap } from "effect"
import { UploadSessionRepository } from "./repos/upload-session-repository"
import { ZipKVRepository } from "./repos/zip-kv-repository"
import { ExifKVRepository } from "./repos/exif-kv-repository"
import { DownloadStateRepository } from "./repos/download-state-repository"

export * from "./repos/upload-session-repository"
export * from "./repos/zip-kv-repository"
export * from "./repos/exif-kv-repository"
export * from "./repos/download-state-repository"
export * from "./key-factory"
export * from "./schema"

export class KVStore extends ServiceMap.Service<KVStore>()("@blikka/packages/kv-store", {
  make: Effect.gen(function* () {
    const uploadRepository = yield* UploadSessionRepository
    const zipRepository = yield* ZipKVRepository
    const exifRepository = yield* ExifKVRepository
    const downloadStateRepository = yield* DownloadStateRepository

    return {
      uploadRepository,
      zipRepository,
      exifRepository,
      downloadStateRepository,
    }
  }),
}) {
  static layer = Layer.effect(this, this.make).pipe(
    Layer.provide(Layer.mergeAll(
      UploadSessionRepository.layer,
      ZipKVRepository.layer,
      ExifKVRepository.layer,
      DownloadStateRepository.layer,
    ))
  )
}
