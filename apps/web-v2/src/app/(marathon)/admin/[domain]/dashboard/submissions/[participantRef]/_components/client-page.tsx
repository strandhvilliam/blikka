"use client"

import { Suspense } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ParticipantHeader } from "./participant-header"
import { ParticipantSubmissionsTab } from "./participant-submissions-tab"
import { ValidationResultsTab } from "./validation-results-tab"
import { ContactSheetTab } from "./contact-sheet-tab"
import { Loader2 } from "lucide-react"

function LoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mb-3" />
      <div className="text-sm text-muted-foreground">Loading...</div>
    </div>
  )
}

const customTabTriggerClassName =
  "relative py-4 px-0 text-sm font-medium transition-colors rounded-none bg-transparent border-none shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-[#FF5D4B] dark:data-[state=active]:text-[#FF7A6B] text-muted-foreground hover:text-foreground data-[state=active]:after:content-[''] data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-[#FF5D4B] dark:data-[state=active]:after:bg-[#FF7A6B]"

export function ParticipantSubmissionClientPage({ participantRef }: { participantRef: string }) {
  return (
    <Tabs defaultValue="submissions" className="space-y-0">
      <div className="border-b border-border">
        <TabsList className="bg-transparent rounded-none p-0 h-auto flex gap-8 -mb-px">
          <TabsTrigger value="submissions" className={customTabTriggerClassName}>
            Submissions
          </TabsTrigger>
          <TabsTrigger value="validation" className={customTabTriggerClassName}>
            Validation Results
          </TabsTrigger>
          <TabsTrigger value="contact-sheet" className={customTabTriggerClassName}>
            Contact Sheet
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="submissions" className="mt-6">
        <Suspense fallback={<LoadingFallback />}>
          <ParticipantSubmissionsTab participantRef={participantRef} />
        </Suspense>
      </TabsContent>

      <TabsContent value="validation" className="mt-6">
        <Suspense fallback={<LoadingFallback />}>
          <ValidationResultsTab participantRef={participantRef} />
        </Suspense>
      </TabsContent>

      <TabsContent value="contact-sheet" className="mt-6">
        <Suspense fallback={<LoadingFallback />}>
          <ContactSheetTab participantRef={participantRef} />
        </Suspense>
      </TabsContent>
    </Tabs>
  )
}
