"use client"

import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

const VALID_CONTACT_SHEET_PHOTO_AMOUNT = [8, 24]

const AWS_S3_BASE_URL = "https://s3.eu-north-1.amazonaws.com"
const CONTACT_SHEETS_BUCKET_NAME = process.env.NEXT_PUBLIC_CONTACT_SHEETS_BUCKET_NAME
const CONTACT_SHEETS_BUCKET_BASE_URL = `${AWS_S3_BASE_URL}/${CONTACT_SHEETS_BUCKET_NAME}`

export function ContactSheetTab({ participantRef }: { participantRef: string }) {
  const domain = useDomain()
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const { data: participant } = useSuspenseQuery(
    trpc.participants.getByReference.queryOptions({
      reference: participantRef,
      domain,
    }),
  )

  const generateContactSheetMutation = useMutation(
    trpc.contactSheets.generateContactSheet.mutationOptions(),
  )

  const hasContactSheet = participant.contactSheets.length > 0
  const canGenerate = participant.status === "completed" || participant.status === "verified"
  const numOfContactSheets = participant.contactSheets.length
  const contactSheet = participant.contactSheets.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0]

  const handleGenerateContactSheet = () => {
    generateContactSheetMutation.mutate(
      {
        domain,
        reference: participantRef,
      },
      {
        onSuccess: () => {
          toast.success("Contact sheet generated successfully")
          queryClient.invalidateQueries({
            queryKey: trpc.participants.getByReference.queryKey({
              reference: participantRef,
              domain,
            }),
          })
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Failed to generate contact sheet")
        },
      },
    )
  }

  const handleDownloadContactSheet = () => {
    // const link = document.createElement("a")
    // link.href = `${contactSheetBucketUrl}/${participant.contactSheetKey}`
    // link.download = `contact-sheet-${participant.reference}.jpg`
    // link.target = "_blank"
    // document.body.appendChild(link)
    // link.click()
    // document.body.removeChild(link)
  }

  const isValidAmountOfPhotos = VALID_CONTACT_SHEET_PHOTO_AMOUNT.includes(
    participant.submissions.length,
  )

  if (participant.status === "prepared") {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">
          Contact sheets are not available until photos have been uploaded.
        </p>
      </div>
    )
  }

  if (!hasContactSheet && !isValidAmountOfPhotos) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">
          Invalid amount of photos submitted. Currently only 8 or 24 photos are supported
        </p>
      </div>
    )
  }

  if (hasContactSheet) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center">
          {numOfContactSheets} contact sheets generated
        </div>
        <div className="flex justify-center">
          <img
            src={`${CONTACT_SHEETS_BUCKET_BASE_URL}/${contactSheet.key}`}
            alt="Contact Sheet"
            className="max-w-full h-auto border border-black shadow-lg"
          />
        </div>
        <div className="flex justify-center">
          <Button onClick={handleDownloadContactSheet} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Download Contact Sheet
          </Button>
        </div>
      </div>
    )
  }

  if (canGenerate) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <p className="text-muted-foreground">No contact sheet available</p>
        <Button
          onClick={handleGenerateContactSheet}
          disabled={generateContactSheetMutation.isPending}
        >
          {generateContactSheetMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            "Generate Contact Sheet"
          )}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center py-12">
      <p className="text-muted-foreground">Nothing to show here</p>
    </div>
  )
}
