import { Config, Effect } from 'effect'
import { Resource as SSTResource } from 'sst'
import { ZipDownloader, ZipDownloaderLayer } from '@blikka/uploads/zip-downloader'
import {
  getEnvironmentFromStage,
  makeContainerTaskLayer,
  runContainerTask,
} from '@blikka/task-runtime'

const TASK_NAME = 'zip-downloader'

const runnable = Effect.gen(function* () {
  const jobId = yield* Config.string('JOB_ID')
  const downloader = yield* ZipDownloader
  yield* downloader.runJob(jobId)
}).pipe(Effect.withSpan('ZipDownloader.task'))

const layer = makeContainerTaskLayer({
  taskName: TASK_NAME,
  environment: getEnvironmentFromStage(SSTResource.App.stage),
  workflowLayer: ZipDownloaderLayer,
})

runContainerTask(runnable, layer)
