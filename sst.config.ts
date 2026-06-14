/// <reference path="./.sst/platform/config.d.ts" />
import { existsSync } from 'node:fs'

export default $config({
  app(input) {
    return {
      name: 'blikka',
      removal: input?.stage === 'production' ? 'retain' : 'remove',
      home: 'aws',
      types: {
        ignore: ['repos/effect'],
      },
    }
  },
  async run() {
    const env = {
      UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL!,
      UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN!,
      DEV_DATABASE_USERNAME: process.env.DEV_DATABASE_USERNAME!,
      DEV_DATABASE_PASSWORD: process.env.DEV_DATABASE_PASSWORD!,
      DEV_DATABASE_HOST: process.env.DEV_DATABASE_HOST!,
      DEV_DATABASE_PORT: process.env.DEV_DATABASE_PORT!,
      DEV_DATABASE_NAME: process.env.DEV_DATABASE_NAME!,
      DATABASE_PROVIDER: process.env.DATABASE_PROVIDER ?? 'neon',
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
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY!,
      HMAC_KEY: process.env.HMAC_KEY!,
      NODE_ENV: process.env.NODE_ENV!,
    }

    const ALLOWED_ORIGINS = [
      'http://localhost:3002',
      'https://vimmer.app',
      '*.vimmer.app',
      '*.localhost:3002',
      'https://*.vimmer.app',
      '*.blikka.app',
      'https://*.blikka.app',
      'https://blikka.app',
    ]

    /* BUCKETS */

    const submissionsBucket = new sst.aws.Bucket('V2SubmissionsBucket', {
      access: 'public',
      cors: {
        allowOrigins: ALLOWED_ORIGINS,
        exposeHeaders: ['Access-Control-Allow-Origin'],
      },
    })
    const thumbnailsBucket = new sst.aws.Bucket('V2ThumbnailsBucket', {
      access: 'public',
    })
    const contactSheetsBucket = new sst.aws.Bucket('V2ContactSheetsBucket', {
      access: 'public',
    })
    const sponsorBucket = new sst.aws.Bucket('V2SponsorBucket', {
      access: 'public',
    })
    const zipsBucket = new sst.aws.Bucket('V2ZipsBucket', {
      access: 'public',
      cors: {
        allowOrigins: ALLOWED_ORIGINS,
        exposeHeaders: ['Access-Control-Allow-Origin'],
      },
    })
    const marathonSettingsBucket = new sst.aws.Bucket('V2MarathonSettingsBucket', {
      access: 'public',
      cors: {
        allowOrigins: ALLOWED_ORIGINS,
        exposeHeaders: ['Access-Control-Allow-Origin'],
      },
    })

    /* QUEUES & BUSES */

    const submissionFinalizedBus = new sst.aws.Bus('SubmissionFinalizedBus')

    /* Dead-letter queues for failed messages */
    const uploadProcessorDlq = new sst.aws.Queue('UploadProcessorDLQ')
    const validationDlq = new sst.aws.Queue('ValidationDLQ')
    const sheetGeneratorDlq = new sst.aws.Queue('SheetGeneratorDLQ')
    const uploadFinalizerDlq = new sst.aws.Queue('UploadFinalizerDLQ')
    const votingSmsDlq = new sst.aws.Queue('VotingSmsDLQ')
    const busTargetDlq = new sst.aws.Queue('BusTargetDLQ')

    const uploadProcessorQueue = new sst.aws.Queue('UploadProcessorQueue', {
      dlq: { queue: uploadProcessorDlq.arn, retry: 5 },
      visibilityTimeout: '5 minutes',
    })
    const uploadFinalizerQueue = new sst.aws.Queue('UploadFinalizerQueue', {
      dlq: { queue: uploadFinalizerDlq.arn, retry: 5 },
      visibilityTimeout: '5 minutes',
    })
    const validationQueue = new sst.aws.Queue('ValidationQueue', {
      dlq: { queue: validationDlq.arn, retry: 5 },
      visibilityTimeout: '5 minutes',
    })
    const sheetGeneratorQueue = new sst.aws.Queue('SheetGeneratorQueue', {
      dlq: { queue: sheetGeneratorDlq.arn, retry: 5 },
      visibilityTimeout: '10 minutes',
    })
    const votingSmsQueue = new sst.aws.Queue('VotingSmsQueue', {
      dlq: { queue: votingSmsDlq.arn, retry: 5 },
      visibilityTimeout: '5 minutes',
    })

    /* BUCKET NOTIFICATIONS */

    submissionsBucket.notify({
      notifications: [
        {
          name: 'SubmissionsBucketNotification',
          queue: uploadProcessorQueue,
          events: ['s3:ObjectCreated:*'],
        },
      ],
    })

    /* TASKS */
    const vpc = new sst.aws.Vpc('BlikkaMainVPC')
    const cluster = new sst.aws.Cluster('BlikkaMainCluster', { vpc })

    new sst.aws.Task('ZipDownloaderTask', {
      cluster,
      // Generates any missing per-participant zips from originals (lazily, on download) and merges
      // up to MAX_PARTICIPANTS_PER_ZIP per chunk in memory (S3 download → JSZip → archiver).
      cpu: '2 vCPU',
      memory: '8 GB',
      image: {
        dockerfile: '/tasks/zip-downloader/Dockerfile',
      },
      environment: env,
      link: [zipsBucket, submissionsBucket],
    })

    /* QUEUE HANDLERS */

    const uploadProcessorSubscriber = uploadProcessorQueue.subscribe(
      {
        handler: './tasks/upload-processor/src/index.handler',
        timeout: '2 minutes',
        // Headroom for Sharp decoding up to recordConcurrency*inputConcurrency full-res photos
        // at once (avoids OOM on large HEIC/24MP uploads); also raises CPU for faster resize.
        memory: '2048 MB',
        environment: env,
        nodejs: {
          install: ['sharp'],
        },
        permissions: [
          sst.aws.permission({
            actions: ['s3:ListBucket'],
            resources: [submissionsBucket.arn],
          }),
          sst.aws.permission({
            actions: ['s3:GetObject'],
            resources: [submissionsBucket.arn.apply((arn) => `${arn}/*`)],
          }),
          sst.aws.permission({
            actions: ['s3:PutObject'],
            resources: [thumbnailsBucket.arn.apply((arn) => `${arn}/*`)],
          }),
        ],
        link: [uploadProcessorQueue, submissionsBucket, thumbnailsBucket, submissionFinalizedBus],
      },
      {
        // Report per-message failures so one poison photo doesn't redeliver its whole batch of 10.
        batch: {
          partialResponses: true,
        },
        // Cap how many Lambdas this queue drives. A 600-uploader burst can otherwise scale this
        // function toward the shared 1,000 account concurrency limit and starve the finalize-side
        // workers (validation / sheet-generator / finalizer / zip), pushing their messages to DLQs.
        // ESM maximumConcurrency stops polling at the cap instead of invoking-and-throttling, so it
        // does NOT burn the SQS receive count. ~100 keeps pace with peak load with margin.
        // maximumConcurrency has no first-class option, so it stays a transform.
        transform: {
          eventSourceMapping: (args) => {
            args.scalingConfig = { maximumConcurrency: 100 }
          },
        },
      },
    )

    const sheetGeneratorSubscriber = sheetGeneratorQueue.subscribe(
      {
        handler: './tasks/contact-sheet-generator/src/index.handler',
        timeout: '3 minutes',
        // Reserved floor so contact-sheet generation can't be starved by an upload-processor burst.
        concurrency: { reserved: 50 },
        nodejs: {
          install: ['sharp'],
        },
        environment: env,
        link: [sheetGeneratorQueue, contactSheetsBucket, submissionsBucket, sponsorBucket],
      },
      {
        batch: {
          partialResponses: true,
        },
      },
    )

    const uploadFinalizerSubscriber = uploadFinalizerQueue.subscribe(
      {
        handler: './tasks/upload-finalizer/src/index.handler',
        timeout: '2 minutes',
        // Reserved floor so participant finalization (DB writes) can't be starved by an upload-processor burst.
        concurrency: { reserved: 50 },
        environment: env,
        link: [uploadFinalizerQueue],
      },
      {
        batch: {
          partialResponses: true,
        },
      },
    )

    const validationSubscriber = validationQueue.subscribe(
      {
        handler: './tasks/validation-runner/src/index.handler',
        timeout: '2 minutes',
        // Reserved floor so validation can't be starved by an upload-processor burst.
        concurrency: { reserved: 50 },
        environment: env,
        link: [
          validationQueue,
          submissionsBucket,
          thumbnailsBucket,
          contactSheetsBucket,
          sponsorBucket,
        ],
      },
      {
        batch: {
          partialResponses: true,
        },
      },
    )

    votingSmsQueue.subscribe({
      handler: './tasks/voting-sms-notifier/src/index.handler',
      timeout: '5 minutes',
      environment: env,
      link: [votingSmsQueue],
      permissions: [
        sst.aws.permission({
          actions: ['sns:Publish'],
          resources: ['*'],
        }),
      ],
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
      'ValidationBusSubscription',
      validationQueue,
      busTargetTransform,
    )
    submissionFinalizedBus.subscribeQueue(
      'SheetGeneratorBusSubscription',
      sheetGeneratorQueue,
      busTargetTransform,
    )
    submissionFinalizedBus.subscribeQueue(
      'UploadFinalizerBusSubscription',
      uploadFinalizerQueue,
      busTargetTransform,
    )

    /* EventBridge DLQ policy - allows EventBridge to send failed events to the DLQ */
    const pulumi = await import('@pulumi/pulumi')
    const callerIdentity = aws.getCallerIdentity()
    const region = aws.getRegion()
    new aws.sqs.QueuePolicy('BusTargetDLQPolicy', {
      queueUrl: busTargetDlq.url,
      policy: pulumi
        .all([busTargetDlq.arn, region, callerIdentity])
        .apply(([queueArn, r, identity]) =>
          JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Sid: 'AllowEventBridgeToSendToDLQ',
                Effect: 'Allow',
                Principal: { Service: 'events.amazonaws.com' },
                Action: 'sqs:SendMessage',
                Resource: queueArn,
                Condition: {
                  ArnLike: {
                    'aws:SourceArn': `arn:aws:events:${r.name}:${identity.accountId}:rule/blikka-*`,
                  },
                },
              },
            ],
          }),
        ),
    })

    /* OBSERVABILITY ALARMS
     * CloudWatch alarms → a single SNS topic, so a live event surfaces failures fast.
     * The topic has no subscription yet: subscribe an email/Slack endpoint (console or
     * `aws sns subscribe`) to actually receive alerts. See docs/observability-improvements.md. */
    const alertsTopic = new aws.sns.Topic('ObservabilityAlerts')

    const dlqDepthAlarm = (name: string, queueName: $util.Input<string>) =>
      new aws.cloudwatch.MetricAlarm(name, {
        namespace: 'AWS/SQS',
        metricName: 'ApproximateNumberOfMessagesVisible',
        dimensions: { QueueName: queueName },
        statistic: 'Maximum',
        period: 60,
        evaluationPeriods: 1,
        threshold: 1,
        comparisonOperator: 'GreaterThanOrEqualToThreshold',
        treatMissingData: 'notBreaching',
        alarmActions: [alertsTopic.arn],
        okActions: [alertsTopic.arn],
        alarmDescription: `${name}: messages present in dead-letter queue (silent failure)`,
      })

    const queueBacklogAlarm = (name: string, queueName: $util.Input<string>) =>
      new aws.cloudwatch.MetricAlarm(name, {
        namespace: 'AWS/SQS',
        metricName: 'ApproximateAgeOfOldestMessage',
        dimensions: { QueueName: queueName },
        statistic: 'Maximum',
        period: 60,
        evaluationPeriods: 3,
        threshold: 300,
        comparisonOperator: 'GreaterThanThreshold',
        treatMissingData: 'notBreaching',
        alarmActions: [alertsTopic.arn],
        okActions: [alertsTopic.arn],
        alarmDescription: `${name}: oldest message older than 5 minutes (backlog building)`,
      })

    const lambdaAlarm = (
      name: string,
      functionName: $util.Input<string>,
      metricName: 'Throttles' | 'Errors',
      threshold: number,
    ) =>
      new aws.cloudwatch.MetricAlarm(name, {
        namespace: 'AWS/Lambda',
        metricName,
        dimensions: { FunctionName: functionName },
        statistic: 'Sum',
        period: 60,
        evaluationPeriods: 1,
        threshold,
        comparisonOperator: 'GreaterThanOrEqualToThreshold',
        treatMissingData: 'notBreaching',
        alarmActions: [alertsTopic.arn],
        okActions: [alertsTopic.arn],
        alarmDescription: `${name}: ${metricName} >= ${threshold}`,
      })

    // A message in any DLQ means a photo/finalize/validation silently failed — the #1 signal.
    dlqDepthAlarm('UploadProcessorDLQDepth', uploadProcessorDlq.nodes.queue.name)
    dlqDepthAlarm('UploadFinalizerDLQDepth', uploadFinalizerDlq.nodes.queue.name)
    dlqDepthAlarm('ValidationDLQDepth', validationDlq.nodes.queue.name)
    dlqDepthAlarm('SheetGeneratorDLQDepth', sheetGeneratorDlq.nodes.queue.name)
    dlqDepthAlarm('VotingSmsDLQDepth', votingSmsDlq.nodes.queue.name)
    dlqDepthAlarm('BusTargetDLQDepth', busTargetDlq.nodes.queue.name)

    // Rising oldest-message age on the finalize-side queues = early warning of pool starvation.
    // NOT the upload-processor queue: it is intentionally capped (maximumConcurrency: 100) and
    // messages are designed to wait there during a burst (see docs/upload-pipeline-scaling.md), so a
    // backlog-age alarm on it would false-fire during exactly the healthy live event it should watch.
    queueBacklogAlarm('UploadFinalizerBacklog', uploadFinalizerQueue.nodes.queue.name)
    queueBacklogAlarm('ValidationBacklog', validationQueue.nodes.queue.name)
    queueBacklogAlarm('SheetGeneratorBacklog', sheetGeneratorQueue.nodes.queue.name)

    // Per-subscriber throttles (concurrency starvation, precedes DLQ growth) + errors.
    const subscribers = [
      ['UploadProcessor', uploadProcessorSubscriber],
      ['UploadFinalizer', uploadFinalizerSubscriber],
      ['Validation', validationSubscriber],
      ['SheetGenerator', sheetGeneratorSubscriber],
    ] as const
    for (const [label, subscriber] of subscribers) {
      // `subscribe()` returns Output<QueueLambdaSubscriber>, so reach the function name via apply.
      const functionName = subscriber.apply((s) => s.nodes.function.name)
      lambdaAlarm(`${label}Throttles`, functionName, 'Throttles', 1)
      lambdaAlarm(`${label}Errors`, functionName, 'Errors', 5)
    }

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
