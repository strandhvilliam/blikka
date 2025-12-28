"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { RunStateEvent } from "@blikka/pubsub"
import type { LucideIcon } from "lucide-react"
import { Loader2, CheckCircle2, XCircle } from "lucide-react"

const MIN_DISPLAY_TIME_MS = 2000 // 2 seconds minimum display time

type TaskDisplayConfig = {
  processingLabel: string
  successLabel: string
  errorLabel: string
}

const TASK_DISPLAY_CONFIG: Record<string, TaskDisplayConfig> = {
  "upload-initializer": {
    processingLabel: "Initializing Upload",
    successLabel: "Upload Initialized",
    errorLabel: "Upload Initialization Failed",
  },
  "upload-finalizer": {
    processingLabel: "Finalizing Upload",
    successLabel: "Upload Finalized",
    errorLabel: "Upload Finalization Failed",
  },
  "validation-runner": {
    processingLabel: "Validating Submission",
    successLabel: "Validation Successful",
    errorLabel: "Validation Failed",
  },
  "zip-worker": {
    processingLabel: "Generating ZIP",
    successLabel: "ZIP Generated",
    errorLabel: "ZIP Generation Failed",
  },
  "contact-sheet-generator": {
    processingLabel: "Creating Contact Sheet",
    successLabel: "Contact Sheet Created",
    errorLabel: "Contact Sheet Creation Failed",
  },
}

type QueuedEvent = {
  taskName: string
  state: "start" | "end"
  timestamp: number
  error: string | null
  displayConfig: TaskDisplayConfig
}

type EventQueue = {
  events: QueuedEvent[]
  currentIndex: number
  currentStateStartTime: number | null
  timerId: NodeJS.Timeout | null
}

type DisplayState = {
  label: string
  type: "processing" | "success" | "error"
  icon: LucideIcon
  className: string
  isAnimated: boolean
}

type DisplayStatesMap = Map<string, DisplayState | null>

export function useParticipantEvents() {
  const params = useParams<{ domain: string }>()
  const domain = params?.domain

  // Map of reference -> EventQueue
  const queuesRef = useRef<Map<string, EventQueue>>(new Map())
  const [displayStates, setDisplayStates] = useState<DisplayStatesMap>(new Map())
  // Track references that have been finalized (upload-finalizer end event)
  const finalizedRefsRef = useRef<Set<string>>(new Set())
  const [finalizedRefs, setFinalizedRefs] = useState<Set<string>>(new Set())
  // Track completed events per reference (taskName -> true)
  const completedEventsRef = useRef<Map<string, Set<string>>>(new Map())
  const [completedEvents, setCompletedEvents] = useState<Map<string, Set<string>>>(new Map())
  const resetTriggerRef = useRef(0)

  // Clear all queues and display states
  const clearAll = useCallback(() => {
    queuesRef.current.forEach((queue) => {
      if (queue.timerId) {
        clearTimeout(queue.timerId)
      }
    })
    queuesRef.current.clear()
    setDisplayStates(new Map())
    // Don't clear finalizedRefsRef - these should persist even after refetch
    resetTriggerRef.current += 1
  }, [])

  // Process the next event in a queue
  const processQueue = useCallback((reference: string) => {
    const queue = queuesRef.current.get(reference)
    if (!queue) return

    // If already processing, don't start another
    if (queue.timerId) return

    // Find next start event that hasn't been processed
    let nextStartIndex = queue.currentIndex
    while (nextStartIndex < queue.events.length && queue.events[nextStartIndex].state !== "start") {
      nextStartIndex++
    }

    // If no more start events, keep the current display state (don't clear it)
    // The last completed state will continue to be shown
    if (nextStartIndex >= queue.events.length) {
      queuesRef.current.delete(reference)
      return
    }

    const startEvent = queue.events[nextStartIndex]
    const now = Date.now()

    // Calculate how long we've been showing the current state
    const timeSinceStart = queue.currentStateStartTime ? now - queue.currentStateStartTime : 0

    // Show processing state for start event
    const displayState: DisplayState = {
      label: startEvent.displayConfig.processingLabel,
      type: "processing",
      icon: Loader2,
      className:
        "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
      isAnimated: true,
    }

    // Update display state
    setDisplayStates((prev) => {
      const next = new Map(prev)
      next.set(reference, displayState)
      return next
    })

    // Calculate wait time (ensure minimum 2 seconds)
    const waitTime = Math.max(0, MIN_DISPLAY_TIME_MS - timeSinceStart)

    // Schedule transition to end state
    const timerId = setTimeout(() => {
      const currentQueue = queuesRef.current.get(reference)
      if (!currentQueue) return

      // Find corresponding end event
      let endIndex = nextStartIndex + 1
      while (
        endIndex < currentQueue.events.length &&
        (currentQueue.events[endIndex].taskName !== startEvent.taskName ||
          currentQueue.events[endIndex].state !== "end")
      ) {
        endIndex++
      }

      if (endIndex < currentQueue.events.length) {
        // Found end event, show success/error state
        const endEvent = currentQueue.events[endIndex]
        const hasError = !!endEvent.error

        // Track finalized references (upload-finalizer end without error)
        if (endEvent.taskName === "upload-finalizer" && !hasError) {
          finalizedRefsRef.current.add(reference)
          setFinalizedRefs(new Set(finalizedRefsRef.current))
        }

        // Track completed events (any successful end event)
        if (!hasError) {
          if (!completedEventsRef.current.has(reference)) {
            completedEventsRef.current.set(reference, new Set())
          }
          completedEventsRef.current.get(reference)!.add(endEvent.taskName)
          setCompletedEvents(new Map(completedEventsRef.current))
        }

        const successDisplayState: DisplayState = {
          label: hasError ? endEvent.displayConfig.errorLabel : endEvent.displayConfig.successLabel,
          type: hasError ? "error" : "success",
          icon: hasError ? XCircle : CheckCircle2,
          className: hasError
            ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800"
            : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
          isAnimated: false,
        }

        setDisplayStates((prev) => {
          const next = new Map(prev)
          next.set(reference, successDisplayState)
          return next
        })

        // Check if there's a next start event waiting
        let nextStartAfterEnd = endIndex + 1
        while (
          nextStartAfterEnd < currentQueue.events.length &&
          currentQueue.events[nextStartAfterEnd].state !== "start"
        ) {
          nextStartAfterEnd++
        }

        const hasNextEvent = nextStartAfterEnd < currentQueue.events.length

        if (hasNextEvent) {
          // There's another event waiting, enforce 2-second minimum before transitioning
          const nextTimerId = setTimeout(() => {
            const updatedQueue = queuesRef.current.get(reference)
            if (!updatedQueue) return

            // Move past both start and end events
            updatedQueue.currentIndex = endIndex + 1
            updatedQueue.currentStateStartTime = null
            updatedQueue.timerId = null
            processQueue(reference)
          }, MIN_DISPLAY_TIME_MS)

          currentQueue.timerId = nextTimerId
          currentQueue.currentStateStartTime = Date.now()
        } else {
          // No more events, keep showing the success state (don't wait, don't clear)
          currentQueue.currentIndex = endIndex + 1
          currentQueue.currentStateStartTime = null
          currentQueue.timerId = null
          // Don't delete the queue yet - keep it so we can track the last state
          // The display state will persist
        }
      } else {
        // No end event yet, wait for it (but don't block forever)
        currentQueue.currentIndex = nextStartIndex
        currentQueue.currentStateStartTime = Date.now()
        currentQueue.timerId = null
        // Will be triggered when end event arrives
      }
    }, waitTime)

    queue.timerId = timerId
    queue.currentIndex = nextStartIndex
    queue.currentStateStartTime = now
  }, [])

  // Add event to queue
  const addEventToQueue = useCallback(
    (reference: string, event: QueuedEvent) => {
      let queue = queuesRef.current.get(reference)

      if (!queue) {
        queue = {
          events: [],
          currentIndex: 0,
          currentStateStartTime: null,
          timerId: null,
        }
        queuesRef.current.set(reference, queue)
      }

      // Cap queue at 20 events, drop oldest if exceeded
      const MAX_QUEUE_LENGTH = 20
      if (queue.events.length >= MAX_QUEUE_LENGTH) {
        // Remove oldest event
        queue.events.shift()
        // Adjust currentIndex if needed
        if (queue.currentIndex > 0) {
          queue.currentIndex--
        }
      }

      // Handle end event without corresponding start event
      if (event.state === "end") {
        const hasStartEvent = queue.events.some(
          (e) => e.taskName === event.taskName && e.state === "start"
        )
        if (!hasStartEvent) {
          // Create synthetic start event with timestamp slightly before end
          const syntheticStart: QueuedEvent = {
            ...event,
            state: "start",
            timestamp: event.timestamp - 100, // 100ms before end
            error: null,
          }
          // Insert synthetic start first
          const startInsertIndex = queue.events.findIndex(
            (e) => e.timestamp > syntheticStart.timestamp
          )
          if (startInsertIndex === -1) {
            queue.events.push(syntheticStart)
          } else {
            queue.events.splice(startInsertIndex, 0, syntheticStart)
          }
        }
      }

      // Track finalized references immediately when upload-finalizer end event arrives
      if (event.taskName === "upload-finalizer" && event.state === "end" && !event.error) {
        finalizedRefsRef.current.add(reference)
        setFinalizedRefs(new Set(finalizedRefsRef.current))
      }

      // Track completed events immediately when end event arrives (without error)
      if (event.state === "end" && !event.error) {
        if (!completedEventsRef.current.has(reference)) {
          completedEventsRef.current.set(reference, new Set())
        }
        completedEventsRef.current.get(reference)!.add(event.taskName)
        setCompletedEvents(new Map(completedEventsRef.current))
      }

      // Insert event in chronological order (by timestamp)
      const insertIndex = queue.events.findIndex((e) => e.timestamp > event.timestamp)
      if (insertIndex === -1) {
        queue.events.push(event)
      } else {
        queue.events.splice(insertIndex, 0, event)
      }

      // If queue is not processing, start it
      if (!queue.timerId && queue.currentIndex === 0 && queue.currentStateStartTime === null) {
        processQueue(reference)
      } else if (!queue.timerId && queue.currentStateStartTime !== null) {
        // Queue was waiting for an end event, restart processing
        processQueue(reference)
      }
    },
    [processQueue]
  )

  useEffect(() => {
    if (!domain) {
      return
    }

    const url = `/api/pubsub/participant-events?domain=${encodeURIComponent(domain)}`
    const eventSource = new EventSource(url)

    eventSource.onopen = () => {
      console.log("Connected to participant events stream")
    }

    eventSource.onmessage = (event) => {
      try {
        // Parse PubSubMessage
        const message = JSON.parse(event.data) as {
          payload: RunStateEvent
          channel: string
          timestamp: number
          messageId: string
        }

        const runStateEvent = message.payload as RunStateEvent

        // Validate required fields and filter out "once" events
        if (
          !runStateEvent.reference ||
          !runStateEvent.taskName ||
          !runStateEvent.state ||
          runStateEvent.state === "once"
        ) {
          return
        }

        // Check if task is in our display config
        const displayConfig = TASK_DISPLAY_CONFIG[runStateEvent.taskName]
        if (!displayConfig) {
          return
        }

        // Create queued event
        const queuedEvent: QueuedEvent = {
          taskName: runStateEvent.taskName,
          state: runStateEvent.state as "start" | "end",
          timestamp: runStateEvent.timestamp,
          error: runStateEvent.error,
          displayConfig,
        }

        // Add to queue
        addEventToQueue(runStateEvent.reference, queuedEvent)
      } catch (error) {
        console.error("Failed to parse participant event data:", error)
      }
    }

    eventSource.onerror = (error) => {
      console.error("EventSource error:", error)
    }

    return () => {
      eventSource.close()
      console.log("Disconnected from participant events stream")
      // Cleanup timers on unmount
      queuesRef.current.forEach((queue) => {
        if (queue.timerId) {
          clearTimeout(queue.timerId)
        }
      })
    }
  }, [domain, addEventToQueue])

  // Cleanup stale queues (older than 10 minutes)
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now()
      const STALE_THRESHOLD_MS = 10 * 60 * 1000 // 10 minutes

      queuesRef.current.forEach((queue, reference) => {
        // Check if queue is stale (no activity for 10 minutes)
        const lastEventTime = queue.events[queue.events.length - 1]?.timestamp ?? 0
        const timeSinceLastEvent = now - lastEventTime

        if (timeSinceLastEvent > STALE_THRESHOLD_MS && queue.events.length > 0) {
          // Clear stale queue
          if (queue.timerId) {
            clearTimeout(queue.timerId)
          }
          queuesRef.current.delete(reference)
          setDisplayStates((prev) => {
            const next = new Map(prev)
            next.delete(reference)
            return next
          })
        }
      })
    }, 60000) // Check every minute

    return () => {
      clearInterval(cleanupInterval)
    }
  }, [])

  // Pause processing when tab is hidden (Page Visibility API)
  useEffect(() => {
    if (typeof document === "undefined") return

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab hidden - pause all timers (they'll resume when tab becomes visible)
        queuesRef.current.forEach((queue) => {
          if (queue.timerId) {
            clearTimeout(queue.timerId)
            queue.timerId = null
          }
        })
      } else {
        // Tab visible - resume processing
        queuesRef.current.forEach((queue, reference) => {
          if (!queue.timerId && queue.currentIndex < queue.events.length) {
            processQueue(reference)
          }
        })
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [processQueue])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      queuesRef.current.forEach((queue) => {
        if (queue.timerId) {
          clearTimeout(queue.timerId)
        }
      })
      queuesRef.current.clear()
    }
  }, [])

  return {
    displayStates,
    finalizedRefs,
    completedEvents,
    clearAll,
    resetTrigger: resetTriggerRef.current,
  }
}
