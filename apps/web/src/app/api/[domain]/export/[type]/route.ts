import { NextRequest, NextResponse } from 'next/server'
import { Effect, Option } from 'effect'
import * as XLSX from 'xlsx'

import { appRouter, createTRPCContext, createCallerFactory, ExportsService } from '@blikka/api/trpc'

import { sanitizeFilenameSegment } from '@/app/(marathon)/admin/[domain]/dashboard/export/_lib/sanitize-filename-segment'
import { buildCsv, CSV_BOM, type CsvCell } from '@/lib/csv'
import { buildJuryResultsCsvRows, JURY_RESULTS_CSV_HEADERS } from '@/lib/jury/jury-results-csv'
import { buildJuryImageArchivePlan, type JuryImageBucket } from '@/lib/jury/jury-results-images'
import { getByCameraExportAccessState } from '@/lib/by-camera/by-camera-export-access-state'
import { serverRuntime, type RuntimeDependencies } from '@/lib/server-runtime'
import { buildS3Url } from '@/lib/utils'
import { formatByCameraAllTopicsParticipantRows } from './by-camera-participants-export'

const EXPORT_KEYS = {
  XLSX_PARTICIPANTS: 'xlsx_participants',
  XLSX_SUBMISSIONS: 'xlsx_submissions',
  TXT_VALIDATION_RESULTS: 'txt_validation_results',
  XLSX_PARTICIPANTS_BY_CAMERA_ACTIVE_TOPIC: 'xlsx_participants_by_camera_active_topic',
  XLSX_PARTICIPANTS_BY_CAMERA_ALL_TOPICS: 'xlsx_participants_by_camera_all_topics',
  XLSX_SUBMISSIONS_BY_CAMERA_ACTIVE_TOPIC: 'xlsx_submissions_by_camera_active_topic',
  TXT_VALIDATION_RESULTS_BY_CAMERA_ACTIVE_TOPIC: 'txt_validation_results_by_camera_active_topic',
  BY_CAMERA_TOPIC_IMAGES: 'by_camera_topic_images',
  CSV_JURY_RESULTS: 'csv_jury_results',
  // The result images are no longer zipped: the client writes them straight to a folder the organizer
  // picks (File System Access API). The manifest lists every file and a per-image URL; the browser
  // fetches those one at a time and this route streams each object from S3.
  JURY_RESULT_IMAGES_MANIFEST: 'jury_result_images_manifest',
  JURY_RESULT_IMAGE: 'jury_result_image',
} as const

/** Bucket aliases the single-image proxy will serve — the same three the archive plan emits. */
const JURY_IMAGE_BUCKETS: readonly JuryImageBucket[] = ['submissions', 'thumbnails', 'contact-sheets']

const createCaller = createCallerFactory(appRouter)
type Caller = ReturnType<typeof createCaller>

function getDateStamp() {
  return new Date().toISOString().split('T')[0]
}

/** Local 24h clock for spreadsheet exports: YYYY-MM-DD HH:MM */
function formatExportDateTime(value: string | null | undefined): string {
  if (!value) return 'N/A'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return 'N/A'
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`
}

function createWorkbookResponse(
  data: Array<Record<string, unknown>>,
  filenameBase: string,
  sheetName: string,
) {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(data)

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filenameBase}-${getDateStamp()}.xlsx"`,
    },
  })
}

/** BOM-prefixed so Excel detects UTF-8; see `buildCsv` for the quoting and line-ending rules. */
function buildCsvContent<Header extends string>(
  headers: readonly Header[],
  rows: readonly Readonly<Record<Header, CsvCell>>[],
) {
  return `${CSV_BOM}${buildCsv(headers, rows)}`
}

function createCsvResponse<Header extends string>(
  headers: readonly Header[],
  rows: readonly Readonly<Record<Header, CsvCell>>[],
  filenameBase: string,
) {
  return new NextResponse(buildCsvContent(headers, rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filenameBase}-${getDateStamp()}.csv"`,
    },
  })
}

function getBlockedByCameraExportResponse(
  marathon: Awaited<ReturnType<Caller['marathons']['getByDomain']>>,
) {
  if (marathon.mode !== 'by-camera') {
    return null
  }

  const exportAccess = getByCameraExportAccessState(marathon)

  if (exportAccess.isExportAllowed) {
    return null
  }

  return NextResponse.json(
    {
      error: exportAccess.message?.title ?? 'Exports unavailable',
      details:
        exportAccess.message?.description ??
        'By-camera exports are unavailable for the active topic.',
    },
    { status: exportAccess.state === 'open' ? 403 : 400 },
  )
}

const handleParticipantsExport = Effect.fn('export/xlsx-participants')(function* (
  caller: Caller,
  domain: string,
) {
  const participantsData = yield* Effect.promise(() =>
    caller.exports.getParticipantsExportData({ domain }),
  )

  const formattedData = participantsData.map((participant) => ({
    Reference: participant.reference,
    'First Name': participant.firstname,
    'Last Name': participant.lastname,
    Email: participant.email,
    Status: participant.status ?? '',
    'Competition Class': participant.competitionClassName,
    'Device Group': participant.deviceGroupName,
    'Created At': participant.createdAt ? new Date(participant.createdAt).toLocaleDateString() : '',
    'Upload Count': participant.uploadCount,
  }))

  return createWorkbookResponse(formattedData, 'participants-export', 'Participants')
})

const handleParticipantsExportByCameraActiveTopic = Effect.fn(
  'export/xlsx-participants-by-camera-active-topic',
)(function* (caller: Caller, domain: string) {
  const participantsData = yield* Effect.promise(() =>
    caller.exports.getParticipantsExportDataByCameraActiveTopic({ domain }),
  )

  const formattedData = participantsData.map((participant) => ({
    Reference: participant.reference,
    'First Name': participant.firstname,
    'Last Name': participant.lastname,
    Email: participant.email,
    Status: participant.status ?? '',
    'Competition Class': participant.competitionClassName,
    'Device Group': participant.deviceGroupName,
    'Created At': participant.createdAt ? new Date(participant.createdAt).toLocaleDateString() : '',
    'Upload Count': participant.uploadCount,
  }))

  return createWorkbookResponse(formattedData, 'participants-active-topic-export', 'Participants')
})

const handleParticipantsExportByCameraAllTopics = Effect.fn(
  'export/xlsx-participants-by-camera-all-topics',
)(function* (caller: Caller, domain: string) {
  const participantsData = yield* Effect.promise(() =>
    caller.exports.getParticipantsExportDataByCameraAllTopics({ domain }),
  )

  return createWorkbookResponse(
    formatByCameraAllTopicsParticipantRows(participantsData),
    'participants-all-topics-export',
    'Participants',
  )
})

const handleSubmissionsExport = Effect.fn('export/xlsx-submissions')(function* (
  caller: Caller,
  domain: string,
) {
  const submissionsData = yield* Effect.promise(() =>
    caller.exports.getSubmissionsExportData({ domain }),
  )

  const formattedData = submissionsData.map((submission) => ({
    'Submission ID': submission.submissionId,
    'Participant Reference': submission.participantReference,
    'Participant Name': submission.participantName,
    Email: submission.participantEmail,
    'Phone Number':
      submission.phoneNumber && String(submission.phoneNumber).trim() !== ''
        ? submission.phoneNumber
        : 'N/A',
    'Competition Class': submission.competitionClassName,
    'Device Group': submission.deviceGroupName,
    Topic: submission.topicName,
    Status: submission.submissionStatus,
    'Upload Date': submission.uploadDate ? new Date(submission.uploadDate).toLocaleString() : 'N/A',
    'Last Modified': submission.lastModified
      ? new Date(submission.lastModified).toLocaleString()
      : 'N/A',
    'File Size (bytes)': submission.fileSize,
    'MIME Type': submission.mimeType,
    Dimensions: submission.dimensions,
    'Camera Model': submission.cameraModel,
    'Validations Passed': submission.validationsPassed,
    'Validations Failed': submission.validationsFailed,
    'Original S3 Key': submission.originalKey,
    'Thumbnail S3 Key': submission.thumbnailKey,
  }))

  return createWorkbookResponse(formattedData, 'submissions-export', 'Submissions')
})

const handleSubmissionsExportByCameraActiveTopic = Effect.fn(
  'export/xlsx-submissions-by-camera-active-topic',
)(function* (caller: Caller, domain: string) {
  const submissionsData = yield* Effect.promise(() =>
    caller.exports.getSubmissionsExportDataByCameraActiveTopic({ domain }),
  )

  const submissionsBucket = process.env.NEXT_PUBLIC_SUBMISSIONS_BUCKET_NAME
  const thumbnailsBucket = process.env.NEXT_PUBLIC_THUMBNAILS_BUCKET_NAME

  const formattedData = submissionsData.map((submission) => ({
    'Submission ID': submission.submissionId,
    'Participant Reference': submission.participantReference,
    'Participant Name': submission.participantName,
    Email: submission.participantEmail,
    'Phone Number':
      submission.phoneNumber && String(submission.phoneNumber).trim() !== ''
        ? submission.phoneNumber
        : 'N/A',
    'Device Group': submission.deviceGroupName,
    Topic: submission.topicName,
    Status: submission.submissionStatus,
    'Upload Date': formatExportDateTime(submission.uploadDate),
    Dimensions: submission.dimensions,
    'Camera Model':
      submission.cameraModel && String(submission.cameraModel).trim() !== ''
        ? submission.cameraModel
        : 'Unknown',
    'Validations Passed': submission.validationsPassed,
    'Validations Failed': submission.validationsFailed,
    'Submission URL': buildS3Url(submissionsBucket, submission.originalKey) ?? '',
    'Thumbnail URL': buildS3Url(thumbnailsBucket, submission.thumbnailKey || null) ?? '',
  }))

  return createWorkbookResponse(formattedData, 'submissions-active-topic-export', 'Submissions')
})

function groupValidationResults<T extends { participantReference: string }>(
  validationResults: T[],
) {
  return validationResults.reduce(
    (acc, result) => {
      const participantKey = result.participantReference
      if (!acc[participantKey]) {
        acc[participantKey] = []
      }
      acc[participantKey].push(result)
      return acc
    },
    {} as Record<string, T[]>,
  )
}

const handleValidationResultsExport = Effect.fn('export/txt-validation-results')(function* (
  caller: Caller,
  domain: string,
  onlyFailed: boolean,
  fileFormat: string,
) {
  const validationResults = yield* Effect.promise(() =>
    caller.exports.getValidationResultsExportData({
      domain,
      onlyFailed,
    }),
  )

  if (fileFormat === 'single') {
    let textContent = `Validation Results Export - ${new Date().toLocaleDateString()}\n`
    textContent += `Domain: ${domain}\n`
    textContent += `Filter: ${onlyFailed ? 'Only Failed Results' : 'All Results'}\n`
    textContent += `Total Results: ${validationResults.length}\n\n`

    const resultsByParticipant = groupValidationResults(validationResults)

    Object.entries(resultsByParticipant).forEach(([participantRef, results]) => {
      textContent += `=== PARTICIPANT: ${participantRef} ===\n`
      textContent += `Name: ${results[0]?.participantName}\n`
      textContent += `Total Validation Results: ${results.length}\n\n`

      results.forEach((result, index) => {
        textContent += `--- Result ${index + 1} ---\n`
        textContent += `Rule: ${result.ruleKey}\n`
        textContent += `Severity: ${result.severity.toUpperCase()}\n`
        textContent += `Outcome: ${result.outcome}\n`
        textContent += `Message: ${result.message}\n`
        if (result.fileName) {
          textContent += `File: ${result.fileName}\n`
        }
        textContent += `Date: ${result.createdAt}\n`
        if (result.overruled) {
          textContent += `Status: OVERRULED\n`
        }
        textContent += `\n`
      })
      textContent += `\n`
    })

    return new NextResponse(textContent, {
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="validation-results-export-${getDateStamp()}.txt"`,
      },
    })
  }

  const JSZip = (yield* Effect.promise(() => import('jszip'))).default
  const zip = new JSZip()

  const resultsByParticipant = groupValidationResults(validationResults)

  Object.entries(resultsByParticipant).forEach(([participantRef, results]) => {
    let fileContent = `Validation Results for ${participantRef}\n`
    fileContent += `Export Date: ${new Date().toLocaleDateString()}\n`
    fileContent += `Participant Name: ${results[0]?.participantName}\n`
    fileContent += `Filter: ${onlyFailed ? 'Only Failed Results' : 'All Results'}\n`
    fileContent += `Total Results: ${results.length}\n\n`

    results.forEach((result, index) => {
      fileContent += `--- Result ${index + 1} ---\n`
      fileContent += `Rule: ${result.ruleKey}\n`
      fileContent += `Severity: ${result.severity.toUpperCase()}\n`
      fileContent += `Outcome: ${result.outcome}\n`
      fileContent += `Message: ${result.message}\n`
      if (result.fileName) {
        fileContent += `File: ${result.fileName}\n`
      }
      fileContent += `Date: ${result.createdAt}\n`
      if (result.overruled) {
        fileContent += `Status: OVERRULED\n`
      }
      fileContent += `\n`
    })

    zip.file(`${participantRef}-validation-results.txt`, fileContent)
  })

  const zipBuffer = yield* Effect.promise(() => zip.generateAsync({ type: 'nodebuffer' }))

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="validation-results-export-${getDateStamp()}.zip"`,
    },
  })
})

const handleValidationResultsExportByCameraActiveTopic = Effect.fn(
  'export/txt-validation-results-by-camera-active-topic',
)(function* (caller: Caller, domain: string, onlyFailed: boolean, fileFormat: string) {
  const validationResults = yield* Effect.promise(() =>
    caller.exports.getValidationResultsExportDataByCameraActiveTopic({
      domain,
      onlyFailed,
    }),
  )

  if (fileFormat === 'single') {
    let textContent = `Validation Results Export - ${new Date().toLocaleDateString()}\n`
    textContent += `Domain: ${domain}\n`
    textContent += `Scope: Active Topic Only\n`
    textContent += `Filter: ${onlyFailed ? 'Only Failed Results' : 'All Results'}\n`
    textContent += `Total Results: ${validationResults.length}\n\n`

    const resultsByParticipant = groupValidationResults(validationResults)

    Object.entries(resultsByParticipant).forEach(([participantRef, results]) => {
      textContent += `=== PARTICIPANT: ${participantRef} ===\n`
      textContent += `Name: ${results[0]?.participantName}\n`
      textContent += `Total Validation Results: ${results.length}\n\n`

      results.forEach((result, index) => {
        textContent += `--- Result ${index + 1} ---\n`
        textContent += `Rule: ${result.ruleKey}\n`
        textContent += `Severity: ${result.severity.toUpperCase()}\n`
        textContent += `Outcome: ${result.outcome}\n`
        textContent += `Message: ${result.message}\n`
        if (result.fileName) {
          textContent += `File: ${result.fileName}\n`
        }
        textContent += `Date: ${result.createdAt}\n`
        if (result.overruled) {
          textContent += `Status: OVERRULED\n`
        }
        textContent += `\n`
      })
      textContent += `\n`
    })

    return new NextResponse(textContent, {
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="validation-results-active-topic-export-${getDateStamp()}.txt"`,
      },
    })
  }

  const JSZip = (yield* Effect.promise(() => import('jszip'))).default
  const zip = new JSZip()

  const resultsByParticipant = groupValidationResults(validationResults)

  Object.entries(resultsByParticipant).forEach(([participantRef, results]) => {
    let fileContent = `Validation Results for ${participantRef}\n`
    fileContent += `Export Date: ${new Date().toLocaleDateString()}\n`
    fileContent += `Scope: Active Topic Only\n`
    fileContent += `Participant Name: ${results[0]?.participantName}\n`
    fileContent += `Filter: ${onlyFailed ? 'Only Failed Results' : 'All Results'}\n`
    fileContent += `Total Results: ${results.length}\n\n`

    results.forEach((result, index) => {
      fileContent += `--- Result ${index + 1} ---\n`
      fileContent += `Rule: ${result.ruleKey}\n`
      fileContent += `Severity: ${result.severity.toUpperCase()}\n`
      fileContent += `Outcome: ${result.outcome}\n`
      fileContent += `Message: ${result.message}\n`
      if (result.fileName) {
        fileContent += `File: ${result.fileName}\n`
      }
      fileContent += `Date: ${result.createdAt}\n`
      if (result.overruled) {
        fileContent += `Status: OVERRULED\n`
      }
      fileContent += `\n`
    })

    zip.file(`${participantRef}-validation-results.txt`, fileContent)
  })

  const zipBuffer = yield* Effect.promise(() => zip.generateAsync({ type: 'nodebuffer' }))

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="validation-results-active-topic-export-${getDateStamp()}.zip"`,
    },
  })
})

const handleJuryResultsExport = Effect.fn('export/csv-jury-results')(function* (
  caller: Caller,
  domain: string,
) {
  const results = yield* Effect.promise(() => caller.jury.getJuryResultsByDomain({ domain }))

  return createCsvResponse(
    JURY_RESULTS_CSV_HEADERS,
    buildJuryResultsCsvRows(results),
    'jury-results-export',
  )
})

/**
 * The plan of what to write, as JSON. It carries every folder path, a same-origin URL per image, and
 * the text files (README, CSV, per-juror markers) inline. The browser walks this, recreating the tree
 * under a folder the organizer picks and fetching each image from `JURY_RESULT_IMAGE`.
 */
const handleJuryResultImagesManifest = Effect.fn('export/jury-result-images-manifest')(function* (
  caller: Caller,
  domain: string,
  options: { invitationId?: number; scopeKey?: string },
) {
  const results = yield* Effect.promise(() => caller.jury.getJuryResultsByDomain({ domain }))

  // Built from the same rows as the CSV export, so the copy written next to the photos cannot drift
  // from the folders around it.
  const csv = buildCsvContent(JURY_RESULTS_CSV_HEADERS, buildJuryResultsCsvRows(results))

  const plan = buildJuryImageArchivePlan(results, {
    domain,
    dateStamp: getDateStamp(),
    filter: { invitationId: options.invitationId, scopeKey: options.scopeKey },
    csv,
  })

  if (plan.entryCount === 0) {
    return NextResponse.json(
      {
        error: 'Nothing to export',
        details: 'No juror has picked an entry with an image on record yet.',
      },
      { status: 404 },
    )
  }

  const files = plan.files.map((file) => ({
    path: file.path,
    url: `/api/${domain}/export/${EXPORT_KEYS.JURY_RESULT_IMAGE}?bucket=${
      file.bucket
    }&key=${encodeURIComponent(file.key)}`,
  }))

  return NextResponse.json({
    rootFolder: plan.rootFolder,
    files,
    textFiles: plan.textFiles,
    entryCount: plan.entryCount,
    distinctObjectCount: plan.distinctObjectCount,
  })
})

/** Streams one jury-result image so the browser can write its bytes to disk without hitting S3 CORS. */
const handleJuryResultImage = Effect.fn('export/jury-result-image')(function* (
  bucket: JuryImageBucket,
  key: string,
) {
  const object = yield* ExportsService.use((service) =>
    service.getImageArchiveObject({ bucket, key }),
  )

  // A photo storage no longer has is one missing file for the client to note, not a failed download.
  if (Option.isNone(object)) {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 })
  }

  return new NextResponse(new Uint8Array(object.value), {
    headers: {
      'Content-Type': contentTypeForKey(key),
      'Content-Length': String(object.value.byteLength),
      'Cache-Control': 'private, no-store',
    },
  })
})

function contentTypeForKey(key: string): string {
  const lower = key.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  return 'application/octet-stream'
}

const handleByCameraTopicImagesExport = Effect.fn('export/by-camera-topic-images')(function* (
  domain: string,
) {
  const { topicName, zipBuffer } = yield* ExportsService.use((service) =>
    service.buildByCameraActiveTopicImagesZip({
      domain,
    }),
  )

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${sanitizeFilenameSegment(
        topicName,
      )}-images-${getDateStamp()}.zip"`,
    },
  })
})

function exportGetEffect(
  request: NextRequest,
  { domain, type }: { domain: string; type: string },
): Effect.Effect<NextResponse, unknown, RuntimeDependencies> {
  return Effect.gen(function* () {
    const { searchParams } = new URL(request.url)
    const onlyFailed = searchParams.get('onlyFailed') === 'true'
    const fileFormat = searchParams.get('fileFormat') || 'single'
    const juryInvitationParam = Number(searchParams.get('invitation'))
    const juryInvitationId =
      Number.isInteger(juryInvitationParam) && juryInvitationParam > 0
        ? juryInvitationParam
        : undefined
    const juryScopeKey = searchParams.get('scope') ?? undefined
    const juryImageBucketParam = searchParams.get('bucket')
    const juryImageKey = searchParams.get('key')
    const headers = new Headers(request.headers)

    headers.set('x-marathon-domain', domain)

    const ctx = yield* Effect.promise(() =>
      createTRPCContext({
        runtime: serverRuntime,
        headers,
      }),
    )

    const caller = createCaller(ctx)

    const marathon = yield* Effect.promise(() => caller.marathons.getByDomain({ domain }))
    if (!marathon) {
      return NextResponse.json({ error: 'Marathon not found' }, { status: 404 })
    }

    const blockedByCameraResponse = getBlockedByCameraExportResponse(marathon)

    switch (type) {
      case EXPORT_KEYS.XLSX_PARTICIPANTS:
        if (marathon.mode === 'by-camera') {
          return NextResponse.json(
            {
              error: 'Invalid export type for this marathon mode',
              details: `Use ${EXPORT_KEYS.XLSX_PARTICIPANTS_BY_CAMERA_ALL_TOPICS} for by-camera marathons.`,
            },
            { status: 400 },
          )
        }

        return yield* handleParticipantsExport(caller, domain)

      case EXPORT_KEYS.XLSX_SUBMISSIONS:
        if (marathon.mode === 'by-camera') {
          return NextResponse.json(
            {
              error: 'Invalid export type for this marathon mode',
              details: `Use ${EXPORT_KEYS.XLSX_SUBMISSIONS_BY_CAMERA_ACTIVE_TOPIC} for by-camera marathons.`,
            },
            { status: 400 },
          )
        }

        return yield* handleSubmissionsExport(caller, domain)

      case EXPORT_KEYS.TXT_VALIDATION_RESULTS:
        if (marathon.mode === 'by-camera') {
          return NextResponse.json(
            {
              error: 'Invalid export type for this marathon mode',
              details: `Use ${EXPORT_KEYS.TXT_VALIDATION_RESULTS_BY_CAMERA_ACTIVE_TOPIC} for by-camera marathons.`,
            },
            { status: 400 },
          )
        }

        return yield* handleValidationResultsExport(caller, domain, onlyFailed, fileFormat)

      case EXPORT_KEYS.XLSX_PARTICIPANTS_BY_CAMERA_ACTIVE_TOPIC:
        if (marathon.mode !== 'by-camera') {
          return NextResponse.json(
            { error: 'Invalid export type for this marathon mode' },
            { status: 400 },
          )
        }

        if (blockedByCameraResponse) {
          return blockedByCameraResponse
        }

        return yield* handleParticipantsExportByCameraActiveTopic(caller, domain)

      case EXPORT_KEYS.XLSX_PARTICIPANTS_BY_CAMERA_ALL_TOPICS:
        if (marathon.mode !== 'by-camera') {
          return NextResponse.json(
            { error: 'Invalid export type for this marathon mode' },
            { status: 400 },
          )
        }

        return yield* handleParticipantsExportByCameraAllTopics(caller, domain)

      case EXPORT_KEYS.XLSX_SUBMISSIONS_BY_CAMERA_ACTIVE_TOPIC:
        if (marathon.mode !== 'by-camera') {
          return NextResponse.json(
            { error: 'Invalid export type for this marathon mode' },
            { status: 400 },
          )
        }

        if (blockedByCameraResponse) {
          return blockedByCameraResponse
        }

        return yield* handleSubmissionsExportByCameraActiveTopic(caller, domain)

      case EXPORT_KEYS.TXT_VALIDATION_RESULTS_BY_CAMERA_ACTIVE_TOPIC:
        if (marathon.mode !== 'by-camera') {
          return NextResponse.json(
            { error: 'Invalid export type for this marathon mode' },
            { status: 400 },
          )
        }

        if (blockedByCameraResponse) {
          return blockedByCameraResponse
        }

        return yield* handleValidationResultsExportByCameraActiveTopic(
          caller,
          domain,
          onlyFailed,
          fileFormat,
        )

      case EXPORT_KEYS.BY_CAMERA_TOPIC_IMAGES:
        if (marathon.mode !== 'by-camera') {
          return NextResponse.json(
            { error: 'Invalid export type for this marathon mode' },
            { status: 400 },
          )
        }

        if (blockedByCameraResponse) {
          return blockedByCameraResponse
        }

        return yield* handleByCameraTopicImagesExport(domain)

      // Jury review happens after the marathon has ended, so this one is not gated on the live
      // window or on the marathon mode the way the participant and submission exports are.
      case EXPORT_KEYS.CSV_JURY_RESULTS:
        return yield* handleJuryResultsExport(caller, domain)

      case EXPORT_KEYS.JURY_RESULT_IMAGES_MANIFEST:
        return yield* handleJuryResultImagesManifest(caller, domain, {
          invitationId: juryInvitationId,
          scopeKey: juryScopeKey,
        })

      case EXPORT_KEYS.JURY_RESULT_IMAGE: {
        // The manifest is served by a protected tRPC procedure; this per-image route does its own
        // auth so an image URL cannot be replayed without a session and access to the domain.
        if (!ctx.session) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (!ctx.permissions.some((permission) => permission.domain === domain)) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        if (
          !juryImageBucketParam ||
          !JURY_IMAGE_BUCKETS.includes(juryImageBucketParam as JuryImageBucket) ||
          !juryImageKey
        ) {
          return NextResponse.json({ error: 'Invalid image request' }, { status: 400 })
        }

        return yield* handleJuryResultImage(juryImageBucketParam as JuryImageBucket, juryImageKey)
      }

      default:
        return NextResponse.json({ error: 'Invalid export type' }, { status: 400 })
    }
  })
}

export async function GET(
  request: NextRequest,
  routeContext: { params: Promise<{ domain: string; type: string }> },
) {
  const { domain, type } = await routeContext.params

  try {
    return await serverRuntime.runPromise(exportGetEffect(request, { domain, type }))
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      {
        error: 'Export failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
