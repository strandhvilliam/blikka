import { Effect } from "effect"

export class KeyFactory extends Effect.Service<KeyFactory>()(
  "@blikka/packages/redis-store/key-factory",
  {
    sync: () => ({
      submission: (domain: string, ref: string, formattedOrderIndex: string) =>
        `submission:${domain}:${ref}:${formattedOrderIndex}`,
      exif: (domain: string, ref: string, formattedOrderIndex: string) =>
        `exif:${domain}:${ref}:${formattedOrderIndex}`,
      participant: (domain: string, ref: string) =>
        `participant:${domain}:${ref}`,
      zipProgress: (domain: string, ref: string) =>
        `zip-progress:${domain}:${ref}`,
      downloadState: (jobId: string) => `download-state:${jobId}`,
      downloadStateFiles: (jobId: string) => `download-state:${jobId}:files`,
      downloadProcess: (processId: string) => `download-process:${processId}`,
    }),
  }
) {}
