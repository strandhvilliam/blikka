import { Effect, Layer, ServiceMap } from "effect"

export class KeyFactory extends ServiceMap.Service<KeyFactory>()(
  "@blikka/packages/redis-store/key-factory",
  {
    make: Effect.sync(() => ({
      submission: (domain: string, ref: string, formattedOrderIndex: string) =>
        `submission:${domain}:${ref}:${formattedOrderIndex}`,
      exif: (domain: string, ref: string, formattedOrderIndex: string) =>
        `exif:${domain}:${ref}:${formattedOrderIndex}`,
      participant: (domain: string, ref: string) => `participant:${domain}:${ref}`,
      zipProgress: (domain: string, ref: string) => `zip-progress:${domain}:${ref}`,
      downloadState: (jobId: string) => `download-state:${jobId}`,
      downloadStateFiles: (jobId: string) => `download-state:${jobId}:files`,
      downloadProcess: (processId: string) => `download-process:${processId}`,
      activeDownloadProcess: (domain: string) => `active-download-process:${domain}`,
    })),
  }
) {
  static layer = Layer.effect(this, this.make)
}
