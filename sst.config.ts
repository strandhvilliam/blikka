/// <reference path="./.sst/platform/config.d.ts" />
import { existsSync } from "node:fs"

export default $config({
  app(input) {
    return {
      name: "blikka",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
    }
  },
  async run() {
    const compactEnv = (values: Record<string, string | undefined>) =>
      Object.fromEntries(
        Object.entries(values).filter(([, value]) => value !== undefined && value !== ""),
      ) as Record<string, string>

    const env = {
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
      NEXT_PUBLIC_BLIKKA_PRODUCTION_URL: process.env.NEXT_PUBLIC_BLIKKA_PRODUCTION_URL!,
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
      cors: {
        allowOrigins: ALLOWED_ORIGINS,
        exposeHeaders: ["Access-Control-Allow-Origin"],
      },
    })
    const marathonSettingsBucket = new sst.aws.Bucket("V2MarathonSettingsBucket", {
      access: "public",
      cors: {
        allowOrigins: ALLOWED_ORIGINS,
        exposeHeaders: ["Access-Control-Allow-Origin"],
      },
    })

    /* QUEUES & BUSES */

    const submissionFinalizedBus = new sst.aws.Bus("SubmissionFinalizedBus")

    /* Dead-letter queues for failed messages */
    const uploadProcessorDlq = new sst.aws.Queue("UploadProcessorDLQ")
    const validationDlq = new sst.aws.Queue("ValidationDLQ")
    const sheetGeneratorDlq = new sst.aws.Queue("SheetGeneratorDLQ")
    const zipWorkerDlq = new sst.aws.Queue("ZipWorkerDLQ")
    const uploadFinalizerDlq = new sst.aws.Queue("UploadFinalizerDLQ")
    const votingSmsDlq = new sst.aws.Queue("VotingSmsDLQ")
    const busTargetDlq = new sst.aws.Queue("BusTargetDLQ")

    const uploadProcessorQueue = new sst.aws.Queue("UploadProcessorQueue", {
      dlq: { queue: uploadProcessorDlq.arn, retry: 5 },
      visibilityTimeout: "5 minutes",
    })
    const uploadFinalizerQueue = new sst.aws.Queue("UploadFinalizerQueue", {
      dlq: { queue: uploadFinalizerDlq.arn, retry: 5 },
      visibilityTimeout: "5 minutes",
    })
    const validationQueue = new sst.aws.Queue("ValidationQueue", {
      dlq: { queue: validationDlq.arn, retry: 5 },
      visibilityTimeout: "5 minutes",
    })
    const sheetGeneratorQueue = new sst.aws.Queue("SheetGeneratorQueue", {
      dlq: { queue: sheetGeneratorDlq.arn, retry: 5 },
      visibilityTimeout: "10 minutes",
    })
    const zipWorkerQueue = new sst.aws.Queue("ZipGeneratorQueue", {
      dlq: { queue: zipWorkerDlq.arn, retry: 5 },
      visibilityTimeout: "10 minutes",
    })
    const votingSmsQueue = new sst.aws.Queue("VotingSmsQueue", {
      dlq: { queue: votingSmsDlq.arn, retry: 5 },
      visibilityTimeout: "5 minutes",
    })

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
      timeout: "2 minutes",
      environment: env,
      nodejs: {
        install: ["sharp"],
      },
      permissions: [
        sst.aws.permission({
          actions: ["s3:ListBucket"],
          resources: [submissionsBucket.arn],
        }),
        sst.aws.permission({
          actions: ["s3:GetObject"],
          resources: [submissionsBucket.arn.apply((arn) => `${arn}/*`)],
        }),
        sst.aws.permission({
          actions: ["s3:PutObject"],
          resources: [thumbnailsBucket.arn.apply((arn) => `${arn}/*`)],
        }),
      ],
      link: [uploadProcessorQueue, submissionsBucket, thumbnailsBucket, submissionFinalizedBus],
    })

    sheetGeneratorQueue.subscribe({
      handler: "./tasks/contact-sheet-generator/src/index.handler",
      timeout: "3 minutes",
      nodejs: {
        install: ["sharp"],
      },
      environment: env,
      link: [sheetGeneratorQueue, contactSheetsBucket, submissionsBucket, sponsorBucket],
    })

    uploadFinalizerQueue.subscribe({
      handler: "./tasks/upload-finalizer/src/index.handler",
      timeout: "2 minutes",
      environment: env,
      link: [uploadFinalizerQueue],
    })

    zipWorkerQueue.subscribe({
      handler: "./tasks/zip-worker/src/handler.handler",
      timeout: "5 minutes",
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
      timeout: "2 minutes",
      environment: env,
      link: [
        validationQueue,
        submissionsBucket,
        thumbnailsBucket,
        contactSheetsBucket,
        sponsorBucket,
      ],
    })

    votingSmsQueue.subscribe({
      handler: "./tasks/voting-sms-notifier/src/index.handler",
      timeout: "5 minutes",
      environment: env,
      batch: {
        size: 1,
      },
      link: [votingSmsQueue],
    })

    /* BUS SUBSCRIPTIONS */

    const busTargetTransform = {
      transform: {
        target: (args: aws.cloudwatch.EventTargetArgs) => {
          args.deadLetterConfig = { arn: busTargetDlq.arn }
          args.retryPolicy = { maximumEventAgeInSeconds: 3600, maximumRetryAttempts: 24 }
          return undefined
        },
      },
    }

    submissionFinalizedBus.subscribeQueue(
      "ValidationBusSubscription",
      validationQueue,
      busTargetTransform,
    )
    submissionFinalizedBus.subscribeQueue(
      "SheetGeneratorBusSubscription",
      sheetGeneratorQueue,
      busTargetTransform,
    )
    submissionFinalizedBus.subscribeQueue(
      "ZipGeneratorBusSubscription",
      zipWorkerQueue,
      busTargetTransform,
    )
    submissionFinalizedBus.subscribeQueue(
      "UploadFinalizerBusSubscription",
      uploadFinalizerQueue,
      busTargetTransform,
    )

    /* EventBridge DLQ policy - allows EventBridge to send failed events to the DLQ */
    const pulumi = await import("@pulumi/pulumi")
    const callerIdentity = aws.getCallerIdentity()
    const region = aws.getRegion()
    new aws.sqs.QueuePolicy("BusTargetDLQPolicy", {
      queueUrl: busTargetDlq.url,
      policy: pulumi
        .all([busTargetDlq.arn, region, callerIdentity])
        .apply(([queueArn, r, identity]) =>
          JSON.stringify({
            Version: "2012-10-17",
            Statement: [
              {
                Sid: "AllowEventBridgeToSendToDLQ",
                Effect: "Allow",
                Principal: { Service: "events.amazonaws.com" },
                Action: "sqs:SendMessage",
                Resource: queueArn,
                Condition: {
                  ArnLike: {
                    "aws:SourceArn": `arn:aws:events:${r.name}:${identity.accountId}:rule/blikka-*`,
                  },
                },
              },
            ],
          }),
        ),
    })

    return {
      submissionsBucket: submissionsBucket.name,
      thumbnailsBucket: thumbnailsBucket.name,
      contactSheetsBucket: contactSheetsBucket.name,
      sponsorBucket: sponsorBucket.name,
      zipsBucket: zipsBucket.name,
      marathonSettingsBucket: marathonSettingsBucket.name,
      votingSmsQueueUrl: votingSmsQueue.url,
    }
  },
})
