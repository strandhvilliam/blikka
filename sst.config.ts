/// <reference path="./.sst/platform/config.d.ts" />



export default $config({
  app(input) {
    return {
      name: "blikka",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
    }
  },
  async run() {
    const env = {
      DEV_DATABASE_URL: process.env.DEV_DATABASE_URL!,
      UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL!,
      UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN!,
      DEV_DATABASE_USERNAME: process.env.DEV_DATABASE_USERNAME!,
      DEV_DATABASE_PASSWORD: process.env.DEV_DATABASE_PASSWORD!,
      DEV_DATABASE_HOST: process.env.DEV_DATABASE_HOST!,
      DEV_DATABASE_PORT: process.env.DEV_DATABASE_PORT!,
      DEV_DATABASE_NAME: process.env.DEV_DATABASE_NAME!,
      DATABASE_URL: process.env.DATABASE_URL!,
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET!,
      BETTER_AUTH_URL: process.env.BETTER_AUTH_URL!,
      BLIKKA_PRODUCTION_URL: process.env.BLIKKA_PRODUCTION_URL!,
      RESEND_API_KEY: process.env.RESEND_API_KEY!,
      AXIOM_TOKEN: process.env.AXIOM_TOKEN!,
      THUMBNAILS_BUCKET_NAME: process.env.THUMBNAILS_BUCKET_NAME!,
      SUBMISSIONS_BUCKET_NAME: process.env.SUBMISSIONS_BUCKET_NAME!,
      CONTACT_SHEETS_BUCKET_NAME: process.env.CONTACT_SHEETS_BUCKET_NAME!,
      SPONSORS_BUCKET_NAME: process.env.SPONSORS_BUCKET_NAME!,
      ZIPS_BUCKET_NAME: process.env.ZIPS_BUCKET_NAME!,
    }

    const ALLOWED_ORIGINS = [
      "http://localhost:3002",
      "https://vimmer.app",
      "*.vimmer.app",
      "*.localhost:3002",
      "https://*.vimmer.app",
      "*.blikka.app",
      "https://*.blikka.app",
      "https://blikka.app",
    ]


    /* BUCKETS */

    const submissionsBucket = new sst.aws.Bucket("V2SubmissionsBucket", {
      access: "public",
      policy: [
        {
          effect: "allow",
          actions: ["s3:PutObject"],
          principals: "*",
        },
      ],
      cors: {
        allowOrigins: ALLOWED_ORIGINS,
        exposeHeaders: ["Access-Control-Allow-Origin"],
      },
    })
    const thumbnailsBucket = new sst.aws.Bucket("V2ThumbnailsBucket", {
      access: "public",
    })
    const contactSheetsBucket = new sst.aws.Bucket("V2ContactSheetsBucket", {
      access: "public",
    })
    const sponsorBucket = new sst.aws.Bucket("V2SponsorBucket", {
      access: "public",
    })
    const zipsBucket = new sst.aws.Bucket("V2ZipsBucket", {
      access: "public",
      policy: [
        {
          effect: "allow",
          actions: ["s3:PutObject"],
          principals: "*",
        },
      ],
      cors: {
        allowOrigins: ALLOWED_ORIGINS,
        exposeHeaders: ["Access-Control-Allow-Origin"],
      },
    })
    const marathonSettingsBucket = new sst.aws.Bucket("V2MarathonSettingsBucket", {
      access: "public",
      policy: [
        {
          effect: "allow",
          actions: ["s3:PutObject"],
          principals: "*",
        },
      ],
      cors: {
        allowOrigins: ALLOWED_ORIGINS,
        exposeHeaders: ["Access-Control-Allow-Origin"],
      },
    })

    /* QUEUES & BUSES */

    const submissionFinalizedBus = new sst.aws.Bus("SubmissionFinalizedBus")
    const uploadProcessorQueue = new sst.aws.Queue("UploadStatusQueue")
    const uploadFinalizerQueue = new sst.aws.Queue("UploadFinalizerQueue")
    const validationQueue = new sst.aws.Queue("ValidationQueue")
    const sheetGeneratorQueue = new sst.aws.Queue("SheetGeneratorQueue")
    const zipWorkerQueue = new sst.aws.Queue("ZipGeneratorQueue")

    /* BUCKET NOTIFICATIONS */

    submissionsBucket.notify({
      notifications: [
        {
          name: "SubmissionsBucketNotification",
          queue: uploadProcessorQueue,
          events: ["s3:ObjectCreated:*"],
        },
      ],
    })

    /* TASKS */
    const vpc = new sst.aws.Vpc("BlikkaMainVPC")
    const cluster = new sst.aws.Cluster("BlikkaMainCluster", { vpc })
    const zipHandlerTask = new sst.aws.Task("ZipHandlerTask", {
      cluster,
      image: {
        dockerfile: "/tasks/zip-worker/Dockerfile",
      },
      link: [submissionsBucket, zipsBucket],
      // dev: false,
    })

    const zipDownloaderTask = new sst.aws.Task("ZipDownloaderTask", {
      cluster,
      image: {
        dockerfile: "/tasks/zip-downloader/Dockerfile",
      },
      environment: env,
      link: [zipsBucket],
      // dev: false,
    })

    /* QUEUE HANDLERS */
    uploadProcessorQueue.subscribe({
      handler: "./tasks/upload-processor/src/index.handler",
      environment: env,
      nodejs: {
        install: ["sharp"],
      },
      link: [uploadProcessorQueue, submissionsBucket, thumbnailsBucket, submissionFinalizedBus],
    })

    sheetGeneratorQueue.subscribe({
      handler: "./tasks/contact-sheet-generator/src/index.handler",
      nodejs: {
        install: ["sharp"],
      },
      environment: env,
      link: [sheetGeneratorQueue, contactSheetsBucket, submissionsBucket, sponsorBucket],
    })

    uploadFinalizerQueue.subscribe({
      handler: "./tasks/upload-finalizer/src/index.handler",
      environment: env,
      link: [uploadFinalizerQueue],
    })

    zipWorkerQueue.subscribe({
      handler: "./tasks/zip-worker/src/handler.handler",
      environment: env,
      link: [
        zipWorkerQueue,
        submissionsBucket,
        thumbnailsBucket,
        contactSheetsBucket,
        sponsorBucket,
        zipHandlerTask,
      ],
    })

    validationQueue.subscribe({
      handler: "./tasks/validation-runner/src/index.handler",
      environment: env,
      link: [
        validationQueue,
        submissionsBucket,
        thumbnailsBucket,
        contactSheetsBucket,
        sponsorBucket,
      ],
    })

    /* BUS SUBSCRIPTIONS */

    submissionFinalizedBus.subscribeQueue("ValidationBusSubscription", validationQueue)
    submissionFinalizedBus.subscribeQueue("SheetGeneratorBusSubscription", sheetGeneratorQueue)
    submissionFinalizedBus.subscribeQueue("ZipGeneratorBusSubscription", zipWorkerQueue)
    submissionFinalizedBus.subscribeQueue("UploadFinalizerBusSubscription", uploadFinalizerQueue)

    return {
      submissionsBucket: submissionsBucket.name,
      thumbnailsBucket: thumbnailsBucket.name,
      contactSheetsBucket: contactSheetsBucket.name,
      sponsorBucket: sponsorBucket.name,
      zipsBucket: zipsBucket.name,
      marathonSettingsBucket: marathonSettingsBucket.name,
    }
  },
})
