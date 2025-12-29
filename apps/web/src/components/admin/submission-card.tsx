"use client"

import { AlertTriangle, CheckCircle } from "lucide-react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { Badge } from "@vimmer/ui/components/badge"
import { Card, CardContent, CardFooter } from "@vimmer/ui/components/card"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@vimmer/ui/components/tooltip"
import type { Submission, ValidationResult, Topic } from "@vimmer/api/db/types"
import { cn } from "@vimmer/ui/lib/utils"
import { useParams } from "next/navigation"

interface PhotoSubmissionCardProps {
  submission: Submission
  topic?: Topic
  validationResults?: ValidationResult[]
  imageUrl: string | null
}

export function PhotoSubmissionCard({
  submission,
  validationResults = [],
  topic,
  imageUrl,
}: PhotoSubmissionCardProps) {
  const { participantRef } = useParams<{ participantRef: string }>()

  const submissionValidations = validationResults.filter(
    (result) => result.fileName === submission.key
  )

  const hasFailedValidations = submissionValidations.some((result) => result.outcome === "failed")

  const hasErrors = submissionValidations.some(
    (result) => result.severity === "error" && result.outcome === "failed"
  )

  const hasWarnings = submissionValidations.some(
    (result) => result.severity === "warning" && result.outcome === "failed"
  )

  const allPassed = submissionValidations.length > 0 && !hasFailedValidations

  return (
    <Link href={`/admin/submissions/${participantRef}/${submission.id}`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        layout
        transition={{
          duration: 0.3,
          ease: [0.2, 0.65, 0.3, 0.9],
        }}
      >
        <Card className="group cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all overflow-hidden">
          <CardContent className="relative p-0 flex items-center justify-center aspect-[4/3] bg-neutral-200/40 overflow-hidden">
            <div className="absolute top-2 left-2 z-10">
              <Badge variant="outline" className="bg-white/80 backdrop-blur-sm">
                #{topic?.orderIndex.toString() ? topic.orderIndex + 1 : "?"}
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
                alt={topic?.name ?? ""}
              />
            )}
          </CardContent>
          <CardFooter className="p-4 flex flex-col items-start gap-2 ">
            <div className="flex items-center justify-between w-full">
              <h3 className="font-medium">{topic?.name ?? "Untitled Topic"}</h3>
              {submissionValidations.length > 0 && (
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
                              {submissionValidations
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
