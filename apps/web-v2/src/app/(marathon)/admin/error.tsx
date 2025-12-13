"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, RefreshCw, Bug, ChevronDown, ChevronUp } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

const isDevelopment = process.env.NODE_ENV === "development"

interface ErrorDetails {
  message: string
  stack?: string
  name?: string
  cause?: unknown
}

function formatError(error: Error): ErrorDetails {
  return {
    message: error.message || "An unexpected error occurred",
    stack: error.stack,
    name: error.name,
    cause: error.cause,
  }
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [errorDetails, setErrorDetails] = useState<ErrorDetails>(() => formatError(error))
  const [showDetails, setShowDetails] = useState(isDevelopment)

  useEffect(() => {
    console.error("Error boundary caught:", error)
  }, [error])

  const handleReset = () => {
    window.location.reload()
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-4">
        <Card className="border-destructive/50">
          <CardHeader>
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-destructive/10 p-3">
                <AlertTriangle className="size-6 text-destructive" />
              </div>
              <div className="flex-1 space-y-1">
                <CardTitle className="text-2xl">
                  {isDevelopment ? "Something went wrong" : "Oops! Something went wrong"}
                </CardTitle>
                <CardDescription>
                  {isDevelopment
                    ? "An error occurred while rendering this page. Check the details below for more information."
                    : "We encountered an unexpected error. Please try again or contact support if the problem persists."}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>Error Message</AlertTitle>
              <AlertDescription className="font-mono text-sm">
                {errorDetails.message || "Unknown error"}
              </AlertDescription>
            </Alert>

            {error.digest && (
              <div className="rounded-md bg-muted p-3">
                <p className="text-xs font-medium text-muted-foreground">Error ID</p>
                <p className="mt-1 font-mono text-sm">{error.digest}</p>
              </div>
            )}

            {isDevelopment && (
              <Collapsible open={showDetails} onOpenChange={setShowDetails}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                      <Bug className="size-4" />
                      Developer Details
                    </span>
                    {showDetails ? (
                      <ChevronUp className="size-4" />
                    ) : (
                      <ChevronDown className="size-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-3">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Error Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {errorDetails.name && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Error Type</p>
                          <p className="mt-1 font-mono text-sm">{errorDetails.name}</p>
                        </div>
                      )}

                      {errorDetails.cause != null && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Cause</p>
                          <p className="mt-1 font-mono text-sm break-all">
                            {typeof errorDetails.cause === "string"
                              ? errorDetails.cause
                              : JSON.stringify(errorDetails.cause, null, 2)}
                          </p>
                        </div>
                      )}

                      {errorDetails.stack && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">
                            Stack Trace
                          </p>
                          <ScrollArea className="h-64 w-full rounded-md border bg-muted/50 p-3">
                            <pre className="text-xs font-mono whitespace-pre-wrap wrap-break-word">
                              {errorDetails.stack}
                            </pre>
                          </ScrollArea>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </CollapsibleContent>
              </Collapsible>
            )}

            <Separator />

            <div className="flex gap-2">
              <Button onClick={handleReset} className="flex-1">
                <RefreshCw className="mr-2 size-4" />
                Try Again
              </Button>
              <Button
                variant="outline"
                onClick={() => (window.location.href = "/marathon")}
                className="flex-1"
              >
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
