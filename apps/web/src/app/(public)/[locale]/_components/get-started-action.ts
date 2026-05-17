'use server'

import { getStartedRatelimit, getClientIp } from '@/lib/ratelimit'
import { serverRuntime } from '@/lib/server-runtime'
import { EmailService } from '@blikka/email'
import { Config } from 'effect'
import { headers } from 'next/headers'
import { createElement } from 'react'

interface GetStartedInput {
  name: string
  email: string
  organization: string
  website?: string
  eventType: string
  estimatedParticipants: string
  message: string
}

export async function getStartedAction(input: GetStartedInput) {
  try {
    const readonlyHeaders = await headers()
    const ip = getClientIp(readonlyHeaders)
    const allowed = await getStartedRatelimit.limit(ip)

    if (!allowed) {
      throw new Error('Too many requests. Please try again later.')
    }

    const [emailService, targetEmail] = await Promise.all([
      serverRuntime.runPromise(EmailService),
      serverRuntime.runPromise(Config.string('TARGET_GET_STARTED_EMAIL')),
    ])

    await serverRuntime.runPromise(
      emailService.send({
        to: targetEmail,
        subject: `New demo request from ${input.name} — ${input.organization}`,
        replyTo: input.email,
        template: createElement(
          'div',
          { style: { fontFamily: 'sans-serif', maxWidth: 600, margin: '0 auto' } },
          createElement('h1', { style: { fontSize: 24, marginBottom: 24 } }, 'New Demo Request'),
          createElement(
            'table',
            {
              style: {
                width: '100%',
                borderCollapse: 'collapse' as const,
                marginBottom: 24,
              },
            },
            [
              { label: 'Name', value: input.name },
              { label: 'Email', value: input.email },
              { label: 'Organization', value: input.organization },
              ...(input.website ? [{ label: 'Website', value: input.website }] : []),
              { label: 'Event type', value: input.eventType },
              { label: 'Expected participants', value: input.estimatedParticipants },
            ].map(({ label, value }) =>
              createElement(
                'tr',
                { key: label },
                createElement(
                  'td',
                  {
                    style: {
                      padding: '8px 12px',
                      fontWeight: 600,
                      borderBottom: '1px solid #eee',
                      whiteSpace: 'nowrap' as const,
                      verticalAlign: 'top',
                    },
                  },
                  label,
                ),
                createElement(
                  'td',
                  {
                    style: {
                      padding: '8px 12px',
                      borderBottom: '1px solid #eee',
                    },
                  },
                  value,
                ),
              ),
            ),
          ),
          input.message
            ? createElement(
                'div',
                { style: { marginTop: 8 } },
                createElement(
                  'strong',
                  { style: { display: 'block', marginBottom: 8 } },
                  'Message',
                ),
                createElement(
                  'p',
                  { style: { whiteSpace: 'pre-wrap' as const, margin: 0 } },
                  input.message,
                ),
              )
            : null,
        ),
        tags: [{ name: 'type', value: 'get-started' }],
      }),
    )

    return { data: undefined, error: null }
  } catch (error) {
    return {
      data: undefined,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
