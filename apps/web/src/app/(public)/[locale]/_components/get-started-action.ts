"use server"

import { Action, toActionResponse } from "@/lib/next-utils"
import { EmailService } from "@blikka/email"
import { Effect } from "effect"
import { createElement } from "react"

interface GetStartedInput {
  name: string
  email: string
  organization: string
  eventType: string
  estimatedParticipants: string
  message: string
}

const _getStartedAction = Effect.fn("@blikka/web/getStartedAction")(
  function* (input: GetStartedInput) {
    const emailService = yield* EmailService

    yield* emailService.send({
      to: "hello@blikka.app",
      subject: `New demo request from ${input.name} — ${input.organization}`,
      replyTo: input.email,
      template: createElement(
        "div",
        { style: { fontFamily: "sans-serif", maxWidth: 600, margin: "0 auto" } },
        createElement("h1", { style: { fontSize: 24, marginBottom: 24 } }, "New Demo Request"),
        createElement(
          "table",
          {
            style: {
              width: "100%",
              borderCollapse: "collapse" as const,
              marginBottom: 24,
            },
          },
          [
            { label: "Name", value: input.name },
            { label: "Email", value: input.email },
            { label: "Organization", value: input.organization },
            { label: "Event type", value: input.eventType },
            { label: "Expected participants", value: input.estimatedParticipants },
          ].map(({ label, value }) =>
            createElement(
              "tr",
              { key: label },
              createElement(
                "td",
                {
                  style: {
                    padding: "8px 12px",
                    fontWeight: 600,
                    borderBottom: "1px solid #eee",
                    whiteSpace: "nowrap" as const,
                    verticalAlign: "top",
                  },
                },
                label
              ),
              createElement(
                "td",
                {
                  style: {
                    padding: "8px 12px",
                    borderBottom: "1px solid #eee",
                  },
                },
                value
              )
            )
          )
        ),
        input.message
          ? createElement(
            "div",
            { style: { marginTop: 8 } },
            createElement(
              "strong",
              { style: { display: "block", marginBottom: 8 } },
              "Message"
            ),
            createElement(
              "p",
              { style: { whiteSpace: "pre-wrap" as const, margin: 0 } },
              input.message
            )
          )
          : null
      ),
      tags: [{ name: "type", value: "get-started" }],
    })
  },
  toActionResponse
)

export const getStartedAction = async (input: GetStartedInput) =>
  Action(_getStartedAction)(input)
