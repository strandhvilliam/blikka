"use client"

import { useEffect, useState } from "react"
import { CompetitionClass, Topic } from "@blikka/db"
import { Card, CardContent } from "@/components/ui/card"

interface SubmissionPreviewCardProps {
  competitionClass: CompetitionClass | null
  topic: Topic
  imageUrl: string | null
}

export function SubmissionPreviewCard({
  competitionClass,
  topic,
  imageUrl,
}: SubmissionPreviewCardProps) {
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    setHasError(false)
  }, [imageUrl])

  return (
    <div className="space-y-4">
      <Card className="sticky top-8 overflow-hidden shadow-2xl h-full flex flex-col">
        <CardContent className="p-0 flex flex-1">
          <div className="relative w-full overflow-hidden h-full">
            {imageUrl && !hasError ? (
              <img
                src={imageUrl}
                alt={topic.name}
                className="object-contain w-full h-full max-h-[70vh]"
                onError={() => setHasError(true)}
              />
            ) : imageUrl && hasError ? (
              <div className="w-full h-full flex items-center justify-center bg-muted-foreground/10 p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Cannot preview. Either image is corrupted or a raw file. (Raw files can only be
                  shown when downloaded)
                </p>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted-foreground/10">
                <p className="text-sm text-muted-foreground">Image not available</p>
              </div>
            )}
          </div>
        </CardContent>

        <div className="bg-black p-4 flex flex-col justify-end ">
          <div className="text-white">
            <h3 className="text-xl font-bold">{topic.name}</h3>
            <p className="text-sm opacity-90">
              Topic {topic.orderIndex + 1} of {competitionClass?.numberOfPhotos || "?"}
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
