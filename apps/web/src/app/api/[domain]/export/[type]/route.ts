import { NextRequest, NextResponse } from "next/server"
import { Effect } from "effect"
import * as XLSX from "xlsx"

import {
  appRouter,
  createTRPCContext,
  createCallerFactory,
  ExportsApiService,
} from "@blikka/api/trpc"

import { getByCameraExportAccessState } from "@/lib/topics/by-camera-export-access-state"
import { Route } from "@/lib/next-utils"
import { serverRuntime, type RuntimeDependencies } from "@/lib/server-runtime"

const EXPORT_KEYS = {
  XLSX_PARTICIPANTS: "xlsx_participants",
  XLSX_SUBMISSIONS: "xlsx_submissions",
  TXT_VALIDATION_RESULTS: "txt_validation_results",
  XLSX_PARTICIPANTS_BY_CAMERA_ACTIVE_TOPIC:
    "xlsx_participants_by_camera_active_topic",
  XLSX_SUBMISSIONS_BY_CAMERA_ACTIVE_TOPIC:
    "xlsx_submissions_by_camera_active_topic",
  TXT_VALIDATION_RESULTS_BY_CAMERA_ACTIVE_TOPIC:
    "txt_validation_results_by_camera_active_topic",
  BY_CAMERA_TOPIC_IMAGES: "by_camera_topic_images",
} as const

const createCaller = createCallerFactory(appRouter)
type Caller = ReturnType<typeof createCaller>

function getDateStamp() {
  return new Date().toISOString().split("T")[0]
}

function sanitizeFilenameSegment(value: string | null | undefined) {
  if (!value) {
    return "active-topic"
  }

  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function createWorkbookResponse(
  data: Array<Record<string, unknown>>,
  filenameBase: string,
  sheetName: string,
) {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(data)

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filenameBase}-${getDateStamp()}.xlsx"`,
    },
  })
}

function getBlockedByCameraExportResponse(
  marathon: Awaited<ReturnType<Caller["marathons"]["getByDomain"]>>,
) {
  if (marathon.mode !== "by-camera") {
    return null
  }

  const exportAccess = getByCameraExportAccessState(marathon)

  if (exportAccess.isExportAllowed) {
    return null
  }

  return NextResponse.json(
    {
      error: exportAccess.message?.title ?? "Exports unavailable",
      details:
        exportAccess.message?.description ??
        "By-camera exports are unavailable for the active topic.",
    },
    { status: exportAccess.state === "open" ? 403 : 400 },
  )
}

const handleParticipantsExport = Effect.fn("export/xlsx-participants")(function* (
  caller: Caller,
  domain: string,
) {
  const participantsData = yield* Effect.promise(() =>
    caller.exports.getParticipantsExportData({ domain }),
  )

  const formattedData = participantsData.map((participant) => ({
    Reference: participant.reference,
    "First Name": participant.firstname,
    "Last Name": participant.lastname,
    Email: participant.email,
    Status: participant.status ?? "",
    "Competition Class": participant.competitionClassName,
    "Device Group": participant.deviceGroupName,
    "Created At": participant.createdAt
      ? new Date(participant.createdAt).toLocaleDateString()
      : "",
    "Upload Count": participant.uploadCount,
  }))

  return createWorkbookResponse(formattedData, "participants-export", "Participants")
})

const handleParticipantsExportByCameraActiveTopic = Effect.fn(
  "export/xlsx-participants-by-camera-active-topic",
)(function* (caller: Caller, domain: string) {
  const participantsData = yield* Effect.promise(() =>
    caller.exports.getParticipantsExportDataByCameraActiveTopic({ domain }),
  )

  const formattedData = participantsData.map((participant) => ({
    Reference: participant.reference,
    "First Name": participant.firstname,
    "Last Name": participant.lastname,
    Email: participant.email,
    Status: participant.status ?? "",
    "Competition Class": participant.competitionClassName,
    "Device Group": participant.deviceGroupName,
    "Created At": participant.createdAt
      ? new Date(participant.createdAt).toLocaleDateString()
      : "",
    "Upload Count": participant.uploadCount,
  }))

  return createWorkbookResponse(
    formattedData,
    "participants-active-topic-export",
    "Participants",
  )
})

const handleSubmissionsExport = Effect.fn("export/xlsx-submissions")(function* (
  caller: Caller,
  domain: string,
) {
  const submissionsData = yield* Effect.promise(() =>
    caller.exports.getSubmissionsExportData({ domain }),
  )

  const formattedData = submissionsData.map((submission) => ({
    "Submission ID": submission.submissionId,
    "Participant Reference": submission.participantReference,
    "Participant Name": submission.participantName,
    Email: submission.participantEmail,
    "Competition Class": submission.competitionClassName,
    "Device Group": submission.deviceGroupName,
    Topic: submission.topicName,
    Status: submission.submissionStatus,
    "Upload Date": submission.uploadDate
      ? new Date(submission.uploadDate).toLocaleString()
      : "N/A",
    "Last Modified": submission.lastModified
      ? new Date(submission.lastModified).toLocaleString()
      : "N/A",
    "File Size (bytes)": submission.fileSize,
    "MIME Type": submission.mimeType,
    Dimensions: submission.dimensions,
    "Camera Model": submission.cameraModel,
    "Validations Passed": submission.validationsPassed,
    "Validations Failed": submission.validationsFailed,
    "Original S3 Key": submission.originalKey,
    "Thumbnail S3 Key": submission.thumbnailKey,
  }))

  return createWorkbookResponse(formattedData, "submissions-export", "Submissions")
})

const handleSubmissionsExportByCameraActiveTopic = Effect.fn(
  "export/xlsx-submissions-by-camera-active-topic",
)(function* (caller: Caller, domain: string) {
  const submissionsData = yield* Effect.promise(() =>
    caller.exports.getSubmissionsExportDataByCameraActiveTopic({ domain }),
  )

  const formattedData = submissionsData.map((submission) => ({
    "Submission ID": submission.submissionId,
    "Participant Reference": submission.participantReference,
    "Participant Name": submission.participantName,
    Email: submission.participantEmail,
    "Competition Class": submission.competitionClassName,
    "Device Group": submission.deviceGroupName,
    Topic: submission.topicName,
    Status: submission.submissionStatus,
    "Upload Date": submission.uploadDate
      ? new Date(submission.uploadDate).toLocaleString()
      : "N/A",
    "Last Modified": submission.lastModified
      ? new Date(submission.lastModified).toLocaleString()
      : "N/A",
    "File Size (bytes)": submission.fileSize,
    "MIME Type": submission.mimeType,
    Dimensions: submission.dimensions,
    "Camera Model": submission.cameraModel,
    "Validations Passed": submission.validationsPassed,
    "Validations Failed": submission.validationsFailed,
    "Original S3 Key": submission.originalKey,
    "Thumbnail S3 Key": submission.thumbnailKey,
  }))

  return createWorkbookResponse(
    formattedData,
    "submissions-active-topic-export",
    "Submissions",
  )
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

const handleValidationResultsExport = Effect.fn("export/txt-validation-results")(
  function* (caller: Caller, domain: string, onlyFailed: boolean, fileFormat: string) {
    const validationResults = yield* Effect.promise(() =>
      caller.exports.getValidationResultsExportData({
        domain,
        onlyFailed,
      }),
    )

    if (fileFormat === "single") {
      let textContent = `Validation Results Export - ${new Date().toLocaleDateString()}\n`
      textContent += `Domain: ${domain}\n`
      textContent += `Filter: ${onlyFailed ? "Only Failed Results" : "All Results"}\n`
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
          "Content-Type": "text/plain",
          "Content-Disposition": `attachment; filename="validation-results-export-${getDateStamp()}.txt"`,
        },
      })
    }

    const JSZip = (yield* Effect.promise(() => import("jszip"))).default
    const zip = new JSZip()

    const resultsByParticipant = groupValidationResults(validationResults)

    Object.entries(resultsByParticipant).forEach(([participantRef, results]) => {
      let fileContent = `Validation Results for ${participantRef}\n`
      fileContent += `Export Date: ${new Date().toLocaleDateString()}\n`
      fileContent += `Participant Name: ${results[0]?.participantName}\n`
      fileContent += `Filter: ${onlyFailed ? "Only Failed Results" : "All Results"}\n`
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

    const zipBuffer = yield* Effect.promise(() =>
      zip.generateAsync({ type: "nodebuffer" }),
    )

    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="validation-results-export-${getDateStamp()}.zip"`,
      },
    })
  },
)

const handleValidationResultsExportByCameraActiveTopic = Effect.fn(
  "export/txt-validation-results-by-camera-active-topic",
)(function* (
  caller: Caller,
  domain: string,
  onlyFailed: boolean,
  fileFormat: string,
) {
  const validationResults = yield* Effect.promise(() =>
    caller.exports.getValidationResultsExportDataByCameraActiveTopic({
      domain,
      onlyFailed,
    }),
  )

  if (fileFormat === "single") {
    let textContent = `Validation Results Export - ${new Date().toLocaleDateString()}\n`
    textContent += `Domain: ${domain}\n`
    textContent += `Scope: Active Topic Only\n`
    textContent += `Filter: ${onlyFailed ? "Only Failed Results" : "All Results"}\n`
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
        "Content-Type": "text/plain",
        "Content-Disposition": `attachment; filename="validation-results-active-topic-export-${getDateStamp()}.txt"`,
      },
    })
  }

  const JSZip = (yield* Effect.promise(() => import("jszip"))).default
  const zip = new JSZip()

  const resultsByParticipant = groupValidationResults(validationResults)

  Object.entries(resultsByParticipant).forEach(([participantRef, results]) => {
    let fileContent = `Validation Results for ${participantRef}\n`
    fileContent += `Export Date: ${new Date().toLocaleDateString()}\n`
    fileContent += `Scope: Active Topic Only\n`
    fileContent += `Participant Name: ${results[0]?.participantName}\n`
    fileContent += `Filter: ${onlyFailed ? "Only Failed Results" : "All Results"}\n`
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

  const zipBuffer = yield* Effect.promise(() =>
    zip.generateAsync({ type: "nodebuffer" }),
  )

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="validation-results-active-topic-export-${getDateStamp()}.zip"`,
    },
  })
})

const handleByCameraTopicImagesExport = Effect.fn("export/by-camera-topic-images")(
  function* (domain: string) {
    const { topicName, zipBuffer } = yield* ExportsApiService.use((service) =>
      service.buildByCameraActiveTopicImagesZip({
        domain,
      }),
    )

    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${sanitizeFilenameSegment(
          topicName,
        )}-images-${getDateStamp()}.zip"`,
      },
    })
  },
)

const exportGetImpl = Effect.fn("@blikka/web/exportGET")(function* (
  request: NextRequest,
  routeContext: { params: Promise<{ domain: string; type: string }> },
) {
  const { domain, type } = yield* Effect.promise(() => routeContext.params)
  const { searchParams } = new URL(request.url)
  const onlyFailed = searchParams.get("onlyFailed") === "true"
  const fileFormat = searchParams.get("fileFormat") || "single"
  const headers = new Headers(request.headers)

  headers.set("x-marathon-domain", domain)

  const ctx = yield* Effect.promise(() =>
    createTRPCContext({
      runtime: serverRuntime,
      headers,
    }),
  )

  const caller = createCaller(ctx)

  const marathon = yield* Effect.promise(() => caller.marathons.getByDomain({ domain }))
  if (!marathon) {
    return NextResponse.json({ error: "Marathon not found" }, { status: 404 })
  }

  const blockedByCameraResponse = getBlockedByCameraExportResponse(marathon)

  switch (type) {
    case EXPORT_KEYS.XLSX_PARTICIPANTS:
      if (marathon.mode === "by-camera") {
        if (blockedByCameraResponse) {
          return blockedByCameraResponse
        }

        return yield* handleParticipantsExportByCameraActiveTopic(caller, domain)
      }

      return yield* handleParticipantsExport(caller, domain)

    case EXPORT_KEYS.XLSX_SUBMISSIONS:
      if (marathon.mode === "by-camera") {
        if (blockedByCameraResponse) {
          return blockedByCameraResponse
        }

        return yield* handleSubmissionsExportByCameraActiveTopic(caller, domain)
      }

      return yield* handleSubmissionsExport(caller, domain)

    case EXPORT_KEYS.TXT_VALIDATION_RESULTS:
      if (marathon.mode === "by-camera") {
        if (blockedByCameraResponse) {
          return blockedByCameraResponse
        }

        return yield* handleValidationResultsExportByCameraActiveTopic(
          caller,
          domain,
          onlyFailed,
          fileFormat,
        )
      }

      return yield* handleValidationResultsExport(caller, domain, onlyFailed, fileFormat)

    case EXPORT_KEYS.XLSX_PARTICIPANTS_BY_CAMERA_ACTIVE_TOPIC:
      if (marathon.mode !== "by-camera") {
        return NextResponse.json(
          { error: "Invalid export type for this marathon mode" },
          { status: 400 },
        )
      }

      if (blockedByCameraResponse) {
        return blockedByCameraResponse
      }

      return yield* handleParticipantsExportByCameraActiveTopic(caller, domain)

    case EXPORT_KEYS.XLSX_SUBMISSIONS_BY_CAMERA_ACTIVE_TOPIC:
      if (marathon.mode !== "by-camera") {
        return NextResponse.json(
          { error: "Invalid export type for this marathon mode" },
          { status: 400 },
        )
      }

      if (blockedByCameraResponse) {
        return blockedByCameraResponse
      }

      return yield* handleSubmissionsExportByCameraActiveTopic(caller, domain)

    case EXPORT_KEYS.TXT_VALIDATION_RESULTS_BY_CAMERA_ACTIVE_TOPIC:
      if (marathon.mode !== "by-camera") {
        return NextResponse.json(
          { error: "Invalid export type for this marathon mode" },
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
      if (marathon.mode !== "by-camera") {
        return NextResponse.json(
          { error: "Invalid export type for this marathon mode" },
          { status: 400 },
        )
      }

      if (blockedByCameraResponse) {
        return blockedByCameraResponse
      }

      return yield* handleByCameraTopicImagesExport(domain)

    default:
      return NextResponse.json({ error: "Invalid export type" }, { status: 400 })
  }
})

function exportGet(
  request: NextRequest,
  routeContext: { params: Promise<{ domain: string; type: string }> },
): Effect.Effect<NextResponse, never, RuntimeDependencies> {
  return exportGetImpl(request, routeContext).pipe(
    Effect.tapError((error) => Effect.logError(error)),
    Effect.catch((error: unknown) =>
      Effect.succeed(
        NextResponse.json(
          {
            error: "Export failed",
            details: error instanceof Error ? error.message : "Unknown error",
          },
          { status: 500 },
        ),
      ),
    ),
  )
}

export const GET = Route(exportGet)
