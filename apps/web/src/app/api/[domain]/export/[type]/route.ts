import { NextRequest, NextResponse } from "next/server"
import * as XLSX from "xlsx"

import { appRouter, createTRPCContext, createCallerFactory } from "@blikka/api/trpc"
import { serverRuntime } from "@/lib/server-runtime"

const EXPORT_KEYS = {
  XLSX_PARTICIPANTS: "xlsx_participants",
  XLSX_SUBMISSIONS: "xlsx_submissions",
  TXT_VALIDATION_RESULTS: "txt_validation_results",
} as const

const createCaller = createCallerFactory(appRouter)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ domain: string; type: string }> }
) {
  try {
    const { domain, type } = await params
    const { searchParams } = new URL(request.url)
    const onlyFailed = searchParams.get("onlyFailed") === "true"
    const fileFormat = searchParams.get("fileFormat") || "single"

    // Create tRPC context with runtime and headers
    const ctx = await createTRPCContext({
      runtime: serverRuntime,
      headers: request.headers,
    })

    // Create caller with context
    const caller = createCaller(ctx)

    // Verify marathon exists
    const marathon = await caller.marathons.getByDomain({ domain })
    if (!marathon) {
      return NextResponse.json({ error: "Marathon not found" }, { status: 404 })
    }

    switch (type) {
      case EXPORT_KEYS.XLSX_PARTICIPANTS:
        return await handleParticipantsExport(caller, domain)

      case EXPORT_KEYS.XLSX_SUBMISSIONS:
        return await handleSubmissionsExport(caller, domain)

      case EXPORT_KEYS.TXT_VALIDATION_RESULTS:
        return await handleValidationResultsExport(caller, domain, onlyFailed, fileFormat)

      default:
        return NextResponse.json({ error: "Invalid export type" }, { status: 400 })
    }
  } catch (error) {
    console.error("Export error:", error)
    return NextResponse.json(
      { error: "Export failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

async function handleParticipantsExport(
  caller: ReturnType<typeof createCaller>,
  domain: string
) {
  const participantsData = await caller.exports.getParticipantsExportData({ domain })

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

  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(formattedData)

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, "Participants")

  // Generate buffer
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })

  // Return as downloadable file
  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="participants-export-${new Date().toISOString().split("T")[0]}.xlsx"`,
    },
  })
}

async function handleSubmissionsExport(
  caller: ReturnType<typeof createCaller>,
  domain: string
) {
  const submissionsData = await caller.exports.getSubmissionsExportData({ domain })

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

  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(formattedData)

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, "Submissions")

  // Generate buffer
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })

  // Return as downloadable file
  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="submissions-export-${new Date().toISOString().split("T")[0]}.xlsx"`,
    },
  })
}

async function handleValidationResultsExport(
  caller: ReturnType<typeof createCaller>,
  domain: string,
  onlyFailed: boolean,
  fileFormat: string
) {
  const validationResults = await caller.exports.getValidationResultsExportData({
    domain,
    onlyFailed,
  })

  if (fileFormat === "single") {
    // Single file format
    let textContent = `Validation Results Export - ${new Date().toLocaleDateString()}\n`
    textContent += `Domain: ${domain}\n`
    textContent += `Filter: ${onlyFailed ? "Only Failed Results" : "All Results"}\n`
    textContent += `Total Results: ${validationResults.length}\n\n`

    // Group by participant
    const resultsByParticipant = validationResults.reduce(
      (acc, result) => {
        const participantKey = result.participantReference
        if (!acc[participantKey]) {
          acc[participantKey] = []
        }
        acc[participantKey].push(result)
        return acc
      },
      {} as Record<string, typeof validationResults>
    )

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
        "Content-Disposition": `attachment; filename="validation-results-export-${new Date().toISOString().split("T")[0]}.txt"`,
      },
    })
  } else {
    // Folder format - create a zip with individual files per participant
    const JSZip = (await import("jszip")).default
    const zip = new JSZip()

    // Group by participant
    const resultsByParticipant = validationResults.reduce(
      (acc, result) => {
        const participantKey = result.participantReference
        if (!acc[participantKey]) {
          acc[participantKey] = []
        }
        acc[participantKey].push(result)
        return acc
      },
      {} as Record<string, typeof validationResults>
    )

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

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new NextResponse(zipBuffer as any, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="validation-results-export-${new Date().toISOString().split("T")[0]}.zip"`,
      },
    })
  }
}

