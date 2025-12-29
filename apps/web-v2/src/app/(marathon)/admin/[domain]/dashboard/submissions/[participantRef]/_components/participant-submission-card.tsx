"use client"

import { AlertTriangle, CheckCircle } from "lucide-react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { Submission, ValidationResult, Topic } from "@blikka/db"
import { cn } from "@/lib/utils"
import { useDomain } from "@/lib/domain-provider"

interface ParticipantSubmissionCardProps {
  submission: Submission & { topic: Topic }
  validationResults: ValidationResult[]
  participantRef: string
}

const AWS_S3_BASE_URL = "https://s3.eu-north-1.amazonaws.com"

function getImageUrl(submission: Submission): string | null {
  const thumbnailBaseUrl = process.env.NEXT_PUBLIC_THUMBNAILS_BUCKET_NAME
  const submissionBaseUrl = process.env.NEXT_PUBLIC_SUBMISSIONS_BUCKET_NAME

  if (submission.thumbnailKey && thumbnailBaseUrl) {
    return `${AWS_S3_BASE_URL}/${thumbnailBaseUrl}/${submission.thumbnailKey}`
  }
  if (submission.key && submissionBaseUrl) {
    return `${AWS_S3_BASE_URL}/${submissionBaseUrl}/${submission.key}`
  }
  return null
}

export function ParticipantSubmissionCard({
  submission,
  validationResults,
  participantRef,
}: ParticipantSubmissionCardProps) {
  const domain = useDomain()

  const hasFailedValidations = validationResults.some((result) => result.outcome === "failed")
  const hasErrors = validationResults.some(
    (result) => result.severity === "error" && result.outcome === "failed"
  )
  const hasWarnings = validationResults.some(
    (result) => result.severity === "warning" && result.outcome === "failed"
  )
  const allPassed = validationResults.length > 0 && !hasFailedValidations
  const imageUrl = getImageUrl(submission)

  return (
    <Link href={`/admin/dashboard/submissions/${participantRef}/${submission.topic?.orderIndex}`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        layout
        transition={{
          duration: 0.3,
          ease: [0.2, 0.65, 0.3, 0.9],
        }}
      >
        <Card className="group gap-2 rounded-lg p-0 cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all overflow-hidden">
          <CardContent className="relative p-0 flex items-center justify-center aspect-4/3 bg-neutral-200/60 border-b overflow-hidden">
            <div className="absolute top-2 left-2 z-10">
              <Badge variant="outline" className="bg-white/80 backdrop-blur-sm">
                #{submission.topic?.orderIndex.toString() ? submission.topic.orderIndex + 1 : "?"}
              </Badge>
            </div>

            {!imageUrl ? (
              <div className="w-full h-full flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Image not available</p>
              </div>
            ) : (
              <motion.img
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ opacity: { delay: 0.5, duration: 0.3 } }}
                layout
                className={cn("w-full h-full object-contain rounded-t-lg")}
                src={imageUrl}
                alt={submission.topic?.name ?? ""}
              />
            )}
          </CardContent>
          <CardFooter className="px-4 pb-2 flex flex-col items-start gap-2 ">
            <div className="flex items-center justify-between w-full">
              <h3 className="font-medium">{submission.topic?.name ?? "Untitled Topic"}</h3>
              {validationResults.length > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      {allPassed ? (
                        <Badge className="bg-green-500/15 text-green-600 hover:bg-green-500/20 transition-colors">
                          <CheckCircle className="h-3.5 w-3.5 mr-1" />
                          Valid
                        </Badge>
                      ) : hasErrors ? (
                        <Badge
                          variant="destructive"
                          className="bg-destructive/15 text-destructive hover:bg-destructive/20 transition-colors"
                        >
                          <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                          Error
                        </Badge>
                      ) : hasWarnings ? (
                        <Badge
                          variant="outline"
                          className="bg-yellow-500/15 text-yellow-600 border-yellow-200 hover:bg-yellow-500/20 transition-colors"
                        >
                          <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                          Warning
                        </Badge>
                      ) : null}
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="space-y-2">
                        {hasErrors || hasWarnings ? (
                          <div>
                            <p
                              className={cn(
                                "font-semibold",
                                hasErrors ? "text-destructive" : "text-yellow-500"
                              )}
                            >
                              {hasErrors ? "Errors:" : "Warnings:"}
                            </p>
                            <ul className="list-disc pl-4 space-y-1">
                              {validationResults
                                .filter((result) => result.outcome === "failed")
                                .map((result, i) => (
                                  <li key={i} className="text-sm">
                                    {result.message}
                                  </li>
                                ))}
                            </ul>
                          </div>
                        ) : allPassed ? (
                          <p className="text-green-500">All validations passed</p>
                        ) : null}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </CardFooter>
        </Card>
      </motion.div>
    </Link>
  )
}
