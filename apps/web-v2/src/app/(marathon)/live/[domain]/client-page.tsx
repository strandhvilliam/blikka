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

  const { data: marathon } = useSuspenseQuery(
    trpc.uploadFlow.getPublicMarathon.queryOptions({ domain })
  )
  const mut = useMutation(trpc.uploadFlow.initializeUploadFlow.mutationOptions())

  // Listen to upload state updates via SSE
  const uploadState = useUploadState({
    participantReference: participantData?.reference ?? null,
    domain,
    enabled: !!participantData?.reference && !!domain,
  })

  // Ref for auto-scrolling to latest event
  const eventsScrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (eventsScrollRef.current && uploadState.events.length > 0) {
      eventsScrollRef.current.scrollTo({
        top: eventsScrollRef.current.scrollHeight,
        behavior: "smooth",
      })
    }
  }, [uploadState.events.length])

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
    key: string
  ): Promise<void> {
    const controller = new AbortController()
    const timeoutId = setTimeout(
      () => {
        controller.abort()
      },
      5 * 60 * 1000
    ) // 5 minute timeout

    try {
      setUploadProgress((prev) => ({
        ...prev,
        [key]: { progress: 0, status: "uploading" },
      }))

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

      setUploadProgress((prev) => ({
        ...prev,
        [key]: { progress: 100, status: "success" },
      }))
    } catch (error) {
      clearTimeout(timeoutId)
      const errorMessage = error instanceof Error ? error.message : "Unknown upload error"
      setUploadProgress((prev) => ({
        ...prev,
        [key]: { progress: 0, status: "error", error: errorMessage },
      }))
      throw error
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!participantData) {
      alert("Participant data not loaded yet")
      return
    }

    if (selectedFiles.length === 0) {
      alert("Please select at least one file")
      return
    }

    if (competitionClassId === null || deviceGroupId === null) {
      alert("Please select a competition class and device group")
      return
    }

    try {
      const result = await mut.mutateAsync({
        domain,
        reference: participantData.reference,
        firstname: participantData.firstname,
        lastname: participantData.lastname,
        email: participantData.email,
        competitionClassId,
        deviceGroupId,
      })

      // Reset upload progress
      setUploadProgress({})
      setIsUploading(true)

      // Match files to presigned URLs (in order)
      const filesToUpload = selectedFiles.slice(0, result.length)
      const uploadPromises = filesToUpload.map((file, index) => {
        const presignedData = result[index]
        if (!presignedData) {
          throw new Error(`No presigned URL found for file ${index + 1}`)
        }
        return uploadFileToPresignedUrl(file, presignedData.url, String(presignedData.key))
      })

      await Promise.all(uploadPromises)
      console.log("All files uploaded successfully")
    } catch (error) {
      console.error("Error during upload:", error)
      alert(error instanceof Error ? error.message : "Failed to upload files")
    } finally {
      setIsUploading(false)
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

        <Button
          type="submit"
          disabled={
            mut.isPending ||
            isUploading ||
            !participantData ||
            competitionClassId === null ||
            deviceGroupId === null
          }
        >
          {mut.isPending ? "Initializing..." : isUploading ? "Uploading..." : "Submit"}
        </Button>
      </form>

      {mut.isError && (
        <div className="text-red-600 text-sm">
          Error: {mut.error instanceof Error ? mut.error.message : "Unknown error"}
        </div>
      )}

      {/* Upload Progress */}
      {Object.keys(uploadProgress).length > 0 && (
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

      {/* Upload State Stream */}
      {participantData?.reference && (
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
