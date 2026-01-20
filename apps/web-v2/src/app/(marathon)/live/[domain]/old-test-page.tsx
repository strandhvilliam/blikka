"use client"
import { useMutation, useSuspenseQuery } from "@tanstack/react-query"
import { useTRPC } from "@/lib/trpc/client"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useUploadState } from "@/hooks/use-upload-state"
import { useMultipleUploadStates } from "@/hooks/use-multiple-upload-states"

const getRandomizedParticipantData = async () => {
  // Fetch a random user from JSONPlaceholder
  const res = await fetch("https://jsonplaceholder.typicode.com/users")
  if (!res.ok) throw new Error("Failed to fetch user")
  const users = await res.json()
  const user = users[Math.floor(Math.random() * users.length)]

  return {
    reference: Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0"),
    firstname: user.name.split(" ")[0] || user.username,
    lastname: user.name.split(" ")[1] || "Doe",
    email: user.email,
  }
}

const generateUniqueParticipants = async (count: number) => {
  // Fetch users from JSONPlaceholder
  const res = await fetch("https://jsonplaceholder.typicode.com/users")
  if (!res.ok) throw new Error("Failed to fetch users")
  const users = await res.json()

  // Shuffle users array for randomness
  const shuffledUsers = [...users].sort(() => Math.random() - 0.5)

  const participants: Array<{
    reference: string
    firstname: string
    lastname: string
    email: string
  }> = []
  const usedReferences = new Set<string>()
  const usedEmails = new Set<string>()

  // Generate random starting point for references (between 1000 and 9999)
  const baseReference = Math.floor(Math.random() * 9000) + 1000

  // Generate unique combinations
  for (let i = 0; i < count; i++) {
    // Randomly select users for name combinations
    const baseUserIndex = Math.floor(Math.random() * shuffledUsers.length)
    const nextUserIndex = Math.floor(Math.random() * shuffledUsers.length)
    const baseUser = shuffledUsers[baseUserIndex]!
    const nextUser = shuffledUsers[nextUserIndex]!

    // Generate unique reference (exactly 4 numeric digits as string)
    let reference: string
    let attempts = 0
    do {
      // Use random base + index + attempts to ensure uniqueness
      const num = (baseReference + i + attempts) % 10000
      reference = num.toString().padStart(4, "0")
      attempts++
    } while (usedReferences.has(reference) && attempts < 1000)

    if (usedReferences.has(reference)) {
      // Fallback: use timestamp + random component
      const timestamp = Date.now()
      const random = Math.floor(Math.random() * 1000)
      const fallbackNum = ((timestamp % 9000) + random) % 10000
      reference = fallbackNum.toString().padStart(4, "0")
    }

    // Create unique name combinations with variations
    const baseFirstname = baseUser.name.split(" ")[0] || baseUser.username
    const baseLastname = nextUser.name.split(" ")[1] || nextUser.username || "User"

    // Add random variation to names to ensure uniqueness
    const randomSuffix = Math.floor(Math.random() * 10000)
    const firstname = `${baseFirstname}${randomSuffix}`
    const lastname = `${baseLastname}${randomSuffix}`

    // Generate unique email based on reference and random component
    const emailRandom = Math.floor(Math.random() * 1000000)
    const email = `participant.${reference}.${emailRandom}@test.example.com`

    usedReferences.add(reference)
    usedEmails.add(email)

    participants.push({
      reference,
      firstname,
      lastname,
      email,
    })
  }

  return participants
}

interface ClientPageProps {
  domain: string
}

export function ClientPage({ domain }: ClientPageProps) {
  const trpc = useTRPC()

  const [participantData, setParticipantData] = useState<{
    reference: string
    firstname: string
    lastname: string
    email: string
  } | null>(null)

  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [competitionClassId, setCompetitionClassId] = useState<number | null>(null)
  const [deviceGroupId, setDeviceGroupId] = useState<number | null>(null)
  const [uploadProgress, setUploadProgress] = useState<
    Record<string, { progress: number; status: "uploading" | "success" | "error"; error?: string }>
  >({})
  const [isUploading, setIsUploading] = useState(false)
  const [concurrentParticipants, setConcurrentParticipants] = useState<number>(1)
  const [activeParticipantReferences, setActiveParticipantReferences] = useState<string[]>([])
  const [participantUploads, setParticipantUploads] = useState<
    Record<
      string,
      {
        participant: { reference: string; firstname: string; lastname: string; email: string }
        progress: Record<
          string,
          { progress: number; status: "uploading" | "success" | "error"; error?: string }
        >
        status: "idle" | "uploading" | "success" | "error"
      }
    >
  >({})

  const { data: marathon } = useSuspenseQuery(
    trpc.uploadFlow.getPublicMarathon.queryOptions({ domain })
  )
  const mut = useMutation(trpc.uploadFlow.initializeUploadFlow.mutationOptions())

  // Listen to upload state updates via SSE for single participant (fallback)
  const uploadState = useUploadState({
    participantReference: participantData?.reference ?? null,
    domain,
    enabled: !!participantData?.reference && !!domain && activeParticipantReferences.length === 0,
  })

  // Listen to upload state updates for multiple concurrent participants
  const multipleUploadStates = useMultipleUploadStates({
    participantReferences: activeParticipantReferences,
    domain,
    enabled: activeParticipantReferences.length > 0,
  })

  // Ref for auto-scrolling to latest event
  const eventsScrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    const eventCount =
      activeParticipantReferences.length > 0
        ? multipleUploadStates.allEvents.length
        : uploadState.events.length
    if (eventsScrollRef.current && eventCount > 0) {
      eventsScrollRef.current.scrollTo({
        top: eventsScrollRef.current.scrollHeight,
        behavior: "smooth",
      })
    }
  }, [
    activeParticipantReferences.length,
    multipleUploadStates.allEvents.length,
    uploadState.events.length,
  ])

  // Type assertion for marathon data structure
  const marathonData = marathon as
    | {
        competitionClasses?: Array<{ id: number; name: string }>
        deviceGroups?: Array<{ id: number; name: string }>
      }
    | null
    | undefined

  // Set default values from marathon data
  useEffect(() => {
    if (
      marathonData?.competitionClasses &&
      marathonData.competitionClasses.length > 0 &&
      competitionClassId === null
    ) {
      setCompetitionClassId(marathonData.competitionClasses[0]!.id)
    }
    if (
      marathonData?.deviceGroups &&
      marathonData.deviceGroups.length > 0 &&
      deviceGroupId === null
    ) {
      setDeviceGroupId(marathonData.deviceGroups[0]!.id)
    }
  }, [marathonData, competitionClassId, deviceGroupId])

  useEffect(() => {
    getRandomizedParticipantData().then((data) => {
      setParticipantData(data)
    })
  }, [])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    setSelectedFiles(files)
  }

  async function uploadFileToPresignedUrl(
    file: File,
    presignedUrl: string,
    key: string,
    participantId?: string
  ): Promise<void> {
    const controller = new AbortController()
    const timeoutId = setTimeout(
      () => {
        controller.abort()
      },
      5 * 60 * 1000
    ) // 5 minute timeout

    try {
      if (participantId) {
        setParticipantUploads((prev) => ({
          ...prev,
          [participantId]: {
            ...prev[participantId]!,
            progress: {
              ...prev[participantId]!.progress,
              [key]: { progress: 0, status: "uploading" },
            },
            status: "uploading",
          },
        }))
      } else {
        setUploadProgress((prev) => ({
          ...prev,
          [key]: { progress: 0, status: "uploading" },
        }))
      }

      const response = await fetch(presignedUrl, {
        method: "PUT",
        body: file,
        signal: controller.signal,
        headers: {
          "Content-Type": file.type || "image/jpeg",
        },
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`)
      }

      if (participantId) {
        setParticipantUploads((prev) => ({
          ...prev,
          [participantId]: {
            ...prev[participantId]!,
            progress: {
              ...prev[participantId]!.progress,
              [key]: { progress: 100, status: "success" },
            },
          },
        }))
      } else {
        setUploadProgress((prev) => ({
          ...prev,
          [key]: { progress: 100, status: "success" },
        }))
      }
    } catch (error) {
      clearTimeout(timeoutId)
      const errorMessage = error instanceof Error ? error.message : "Unknown upload error"
      if (participantId) {
        setParticipantUploads((prev) => ({
          ...prev,
          [participantId]: {
            ...prev[participantId]!,
            progress: {
              ...prev[participantId]!.progress,
              [key]: { progress: 0, status: "error", error: errorMessage },
            },
            status: "error",
          },
        }))
      } else {
        setUploadProgress((prev) => ({
          ...prev,
          [key]: { progress: 0, status: "error", error: errorMessage },
        }))
      }
      throw error
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (selectedFiles.length === 0) {
      alert("Please select at least one file")
      return
    }

    if (competitionClassId === null || deviceGroupId === null) {
      alert("Please select a competition class and device group")
      return
    }

    setIsUploading(true)

    try {
      // Generate unique participant data for each concurrent participant
      const participants = await generateUniqueParticipants(concurrentParticipants)

      // Initialize participant uploads state
      const initialUploads: typeof participantUploads = {}
      participants.forEach((participant) => {
        initialUploads[participant.reference] = {
          participant,
          progress: {},
          status: "idle",
        }
      })
      setParticipantUploads(initialUploads)

      // Set active participant references for event stream tracking
      setActiveParticipantReferences(participants.map((p) => p.reference))

      // Create upload tasks for each participant
      // Note: mut.mutateAsync can be called concurrently - React Query handles this
      const uploadTasks = participants.map(async (participant) => {
        try {
          // Initialize upload flow for this participant
          const result = await mut.mutateAsync({
            domain,
            reference: participant.reference,
            firstname: participant.firstname,
            lastname: participant.lastname,
            email: participant.email,
            competitionClassId,
            deviceGroupId,
          })

          // Match files to presigned URLs (in order)
          const filesToUpload = selectedFiles.slice(0, result.length)
          const uploadPromises = filesToUpload.map((file, index) => {
            const presignedData = result[index]
            if (!presignedData) {
              throw new Error(`No presigned URL found for file ${index + 1}`)
            }
            return uploadFileToPresignedUrl(
              file,
              presignedData.url,
              String(presignedData.key),
              participant.reference
            )
          })

          await Promise.all(uploadPromises)

          // Mark participant as successful
          setParticipantUploads((prev) => ({
            ...prev,
            [participant.reference]: {
              ...prev[participant.reference]!,
              status: "success",
            },
          }))

          console.log(`Participant ${participant.reference} uploaded successfully`)
        } catch (error) {
          console.error(`Error uploading for participant ${participant.reference}:`, error)
          setParticipantUploads((prev) => ({
            ...prev,
            [participant.reference]: {
              ...prev[participant.reference]!,
              status: "error",
            },
          }))
          throw error
        }
      })

      await Promise.all(uploadTasks)
      console.log(`All ${concurrentParticipants} participants uploaded successfully`)
    } catch (error) {
      console.error("Error during upload:", error)
      alert(error instanceof Error ? error.message : "Failed to upload files")
    } finally {
      setIsUploading(false)
      // Keep active participant references so users can see all events
      // They will be reset when starting a new upload batch
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">ClientPage</h1>
      <div className="space-y-2">
        <p>Reference: {participantData?.reference}</p>
        <p>Firstname: {participantData?.firstname}</p>
        <p>Lastname: {participantData?.lastname}</p>
        <p>Email: {participantData?.email}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="competitionClassId" className="block text-sm font-medium">
            Competition Class
          </label>
          <Select
            value={competitionClassId?.toString()}
            onValueChange={(value) => setCompetitionClassId(Number(value))}
            required
          >
            <SelectTrigger id="competitionClassId" className="w-full">
              <SelectValue placeholder="Select a competition class" />
            </SelectTrigger>
            <SelectContent>
              {marathonData?.competitionClasses?.map((compClass) => (
                <SelectItem key={compClass.id} value={compClass.id.toString()}>
                  {compClass.name}
                </SelectItem>
              )) ?? null}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label htmlFor="deviceGroupId" className="block text-sm font-medium">
            Device Group
          </label>
          <Select
            value={deviceGroupId?.toString()}
            onValueChange={(value) => setDeviceGroupId(Number(value))}
            required
          >
            <SelectTrigger id="deviceGroupId" className="w-full">
              <SelectValue placeholder="Select a device group" />
            </SelectTrigger>
            <SelectContent>
              {marathonData?.deviceGroups?.map((deviceGroup) => (
                <SelectItem key={deviceGroup.id} value={deviceGroup.id.toString()}>
                  {deviceGroup.name}
                </SelectItem>
              )) ?? null}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label htmlFor="filePicker" className="block text-sm font-medium">
            Select Files
          </label>
          <Input
            id="filePicker"
            type="file"
            multiple
            onChange={handleFileChange}
            accept="image/*"
          />
          {selectedFiles.length > 0 && (
            <p className="text-sm text-gray-600">{selectedFiles.length} file(s) selected</p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="concurrentParticipants" className="block text-sm font-medium">
            Concurrent Participants
          </label>
          <Input
            id="concurrentParticipants"
            type="number"
            min="1"
            max="50"
            value={concurrentParticipants}
            onChange={(e) => {
              const value = parseInt(e.target.value, 10)
              if (!isNaN(value) && value >= 1 && value <= 50) {
                setConcurrentParticipants(value)
              }
            }}
            className="w-full"
            disabled={isUploading}
          />
          <p className="text-xs text-gray-500">
            Number of participants to simulate uploading simultaneously (1-50). Current:{" "}
            {concurrentParticipants}
          </p>
        </div>

        <Button
          type="submit"
          disabled={
            mut.isPending ||
            isUploading ||
            competitionClassId === null ||
            deviceGroupId === null ||
            selectedFiles.length === 0
          }
        >
          {mut.isPending
            ? "Initializing..."
            : isUploading
              ? `Uploading ${concurrentParticipants} participant(s)...`
              : `Submit ${concurrentParticipants} participant(s)`}
        </Button>
      </form>

      {mut.isError && (
        <div className="text-red-600 text-sm">
          Error: {mut.error instanceof Error ? mut.error.message : "Unknown error"}
        </div>
      )}

      {/* Participant Upload Progress */}
      {Object.keys(participantUploads).length > 0 && (
        <div className="mt-4 p-4 border rounded-lg space-y-4">
          <h2 className="text-lg font-semibold">
            Participant Upload Progress ({Object.keys(participantUploads).length} participants)
          </h2>
          <div className="space-y-4">
            {Object.entries(participantUploads).map(([participantId, participantData]) => (
              <div key={participantId} className="p-3 border rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-sm">
                      {participantData.participant.firstname} {participantData.participant.lastname}
                    </p>
                    <p className="text-xs text-gray-500">
                      Ref: {participantData.participant.reference} |{" "}
                      {participantData.participant.email}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded ${
                      participantData.status === "success"
                        ? "bg-green-100 text-green-700"
                        : participantData.status === "error"
                          ? "bg-red-100 text-red-700"
                          : participantData.status === "uploading"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {participantData.status === "success"
                      ? "✓ Complete"
                      : participantData.status === "error"
                        ? "✗ Failed"
                        : participantData.status === "uploading"
                          ? "Uploading..."
                          : "Pending"}
                  </span>
                </div>
                {Object.keys(participantData.progress).length > 0 && (
                  <div className="space-y-2 mt-2">
                    {Object.entries(participantData.progress).map(([key, progress]) => (
                      <div key={key} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="truncate flex-1">{key.split("/").pop()}</span>
                          <span
                            className={
                              progress.status === "success"
                                ? "text-green-600"
                                : progress.status === "error"
                                  ? "text-red-600"
                                  : "text-gray-600"
                            }
                          >
                            {progress.status === "success"
                              ? "✓"
                              : progress.status === "error"
                                ? "✗"
                                : `${progress.progress}%`}
                          </span>
                        </div>
                        {progress.status === "uploading" && (
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${progress.progress}%` }}
                            />
                          </div>
                        )}
                        {progress.error && <p className="text-xs text-red-600">{progress.error}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Single Participant Upload Progress (fallback) */}
      {Object.keys(uploadProgress).length > 0 && Object.keys(participantUploads).length === 0 && (
        <div className="mt-4 p-4 border rounded-lg space-y-2">
          <h2 className="text-lg font-semibold">Upload Progress</h2>
          <div className="space-y-2">
            {Object.entries(uploadProgress).map(([key, progress]) => (
              <div key={key} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="truncate flex-1">{key.split("/").pop()}</span>
                  <span
                    className={
                      progress.status === "success"
                        ? "text-green-600"
                        : progress.status === "error"
                          ? "text-red-600"
                          : "text-gray-600"
                    }
                  >
                    {progress.status === "success"
                      ? "✓ Complete"
                      : progress.status === "error"
                        ? "✗ Failed"
                        : `${progress.progress}%`}
                  </span>
                </div>
                {progress.status === "uploading" && (
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress.progress}%` }}
                    />
                  </div>
                )}
                {progress.error && <p className="text-xs text-red-600">{progress.error}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload State Stream - Multiple Participants */}
      {activeParticipantReferences.length > 0 && (
        <div className="mt-6 p-4 border rounded-lg space-y-2">
          <h2 className="text-lg font-semibold">
            Upload State Stream ({activeParticipantReferences.length} participants)
          </h2>
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-4">
              <p>
                Connected:{" "}
                <span className="text-green-600 font-medium">
                  {multipleUploadStates.totalConnected}/{activeParticipantReferences.length}
                </span>
              </p>
              {multipleUploadStates.totalConnecting > 0 && (
                <p>
                  Connecting:{" "}
                  <span className="text-yellow-600 font-medium">
                    {multipleUploadStates.totalConnecting}
                  </span>
                </p>
              )}
              {multipleUploadStates.hasErrors && (
                <p className="text-red-600 font-medium">Some connections have errors</p>
              )}
            </div>
            {multipleUploadStates.allEvents.length > 0 && (
              <div className="mt-2 space-y-3">
                <p className="font-medium">All Events ({multipleUploadStates.allEvents.length}):</p>
                <div ref={eventsScrollRef} className="space-y-2 max-h-96 overflow-y-auto">
                  {multipleUploadStates.allEvents.map((event, index) => {
                    const participantInfo = participantUploads[event.participantReference]
                    return (
                      <div
                        key={`${event.participantReference}-${event.messageId}-${index}`}
                        className="p-2 bg-gray-50 rounded text-xs border border-gray-200"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <div>
                            <p className="font-medium text-gray-700">
                              Event #{index + 1} - Participant {event.participantReference}
                            </p>
                            {participantInfo && (
                              <p className="text-gray-600 text-xs mt-0.5">
                                {participantInfo.participant.firstname}{" "}
                                {participantInfo.participant.lastname}
                              </p>
                            )}
                          </div>
                          <p className="text-gray-500 text-xs">
                            {new Date(event.timestamp).toLocaleString()}
                          </p>
                        </div>
                        <pre className="mt-1 overflow-auto text-xs">
                          {JSON.stringify(event.payload, null, 2)}
                        </pre>
                        <p className="mt-1 text-gray-500 text-xs">Message ID: {event.messageId}</p>
                        {event.channel && (
                          <p className="text-gray-500 text-xs">Channel: {event.channel}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {multipleUploadStates.allEvents.length === 0 &&
              multipleUploadStates.totalConnected > 0 && (
                <p className="text-gray-500 text-sm mt-2">No events received yet...</p>
              )}
            {Object.entries(multipleUploadStates.states).map(([ref, state]) => (
              <div key={ref} className="mt-2 p-2 bg-gray-50 rounded text-xs">
                <p className="font-medium">
                  Participant {ref}:{" "}
                  <span
                    className={
                      state.isConnected
                        ? "text-green-600"
                        : state.isConnecting
                          ? "text-yellow-600"
                          : "text-gray-600"
                    }
                  >
                    {state.isConnected
                      ? "Connected"
                      : state.isConnecting
                        ? "Connecting..."
                        : "Disconnected"}
                  </span>
                  {state.events.length > 0 && (
                    <span className="text-gray-600 ml-2">({state.events.length} events)</span>
                  )}
                </p>
                {state.error && (
                  <p className="text-red-600 text-xs mt-1">Error: {state.error.message}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload State Stream - Single Participant (fallback) */}
      {participantData?.reference && activeParticipantReferences.length === 0 && (
        <div className="mt-6 p-4 border rounded-lg space-y-2">
          <h2 className="text-lg font-semibold">Upload State Stream</h2>
          <div className="space-y-1 text-sm">
            <p>
              Status:{" "}
              <span
                className={
                  uploadState.isConnected
                    ? "text-green-600"
                    : uploadState.isConnecting
                      ? "text-yellow-600"
                      : "text-gray-600"
                }
              >
                {uploadState.isConnected
                  ? "Connected"
                  : uploadState.isConnecting
                    ? "Connecting..."
                    : "Disconnected"}
              </span>
            </p>
            {uploadState.error && (
              <p className="text-red-600">Error: {uploadState.error.message}</p>
            )}
            {uploadState.events.length > 0 && (
              <div className="mt-2 space-y-3">
                <p className="font-medium">All Events ({uploadState.events.length}):</p>
                <div ref={eventsScrollRef} className="space-y-2 max-h-96 overflow-y-auto">
                  {uploadState.events.map((event, index) => (
                    <div
                      key={`${event.messageId}-${index}`}
                      className="p-2 bg-gray-50 rounded text-xs border border-gray-200"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <p className="font-medium text-gray-700">Event #{index + 1}</p>
                        <p className="text-gray-500 text-xs">
                          {new Date(event.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <pre className="mt-1 overflow-auto text-xs">
                        {JSON.stringify(event.payload, null, 2)}
                      </pre>
                      <p className="mt-1 text-gray-500 text-xs">Message ID: {event.messageId}</p>
                      {event.channel && (
                        <p className="text-gray-500 text-xs">Channel: {event.channel}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {uploadState.events.length === 0 && uploadState.isConnected && (
              <p className="text-gray-500 text-sm mt-2">No events received yet...</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
