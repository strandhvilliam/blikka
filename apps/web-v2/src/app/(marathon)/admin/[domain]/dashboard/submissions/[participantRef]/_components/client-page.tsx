"use client"

import { Suspense } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ParticipantHeader } from "./participant-header"
import { ParticipantSubmissionsTab } from "./participant-submissions-tab"
import { ValidationResultsTab } from "./validation-results-tab"
import { ContactSheetTab } from "./contact-sheet-tab"

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-muted-foreground">Loading...</div>
    </div>
  )
}

export function ParticipantSubmissionClientPage() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <ParticipantHeader />

      <Tabs defaultValue="submissions">
        <TabsList className="bg-background rounded-none p-0 h-auto border-b border-muted-foreground/25 w-full flex justify-start">
          <TabsTrigger
            value="submissions"
            className="px-4 py-2 bg-background rounded-none data-[state=active]:shadow-none data-[state=active]:border-primary border-b-2 border-transparent"
          >
            Submissions
          </TabsTrigger>
          <TabsTrigger
            value="validation"
            className="px-4 py-2 bg-background rounded-none data-[state=active]:shadow-none data-[state=active]:border-primary border-b-2 border-transparent"
          >
            Validation Results
          </TabsTrigger>
          <TabsTrigger
            value="contact-sheet"
            className="px-4 py-2 bg-background rounded-none data-[state=active]:shadow-none data-[state=active]:border-primary border-b-2 border-transparent"
          >
            Contact Sheet
          </TabsTrigger>
        </TabsList>

        <TabsContent value="submissions" className="mt-6">
          <Suspense fallback={<LoadingFallback />}>
            <ParticipantSubmissionsTab />
          </Suspense>
        </TabsContent>

        <TabsContent value="validation" className="mt-6">
          <Suspense fallback={<LoadingFallback />}>
            <ValidationResultsTab />
          </Suspense>
        </TabsContent>

        <TabsContent value="contact-sheet" className="mt-6">
          <Suspense fallback={<LoadingFallback />}>
            <ContactSheetTab />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}
