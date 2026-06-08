import React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import { Tailwind } from '@react-email/tailwind'

export interface JuryInviteEmailProps {
  juryMemberName: string
  marathonName: string
  juryUrl: string
  marathonLogoUrl?: string | null
  scopeLabel: string
  expiresAtLabel: string
  organizerNotes?: string | null
}

export function JuryInviteEmail({
  juryMemberName,
  marathonName,
  juryUrl,
  marathonLogoUrl,
  scopeLabel,
  expiresAtLabel,
  organizerNotes,
}: JuryInviteEmailProps) {
  const previewText = `You have been invited to review submissions for ${marathonName}.`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-slate-100 font-sans py-10">
          <Container className="mx-auto max-w-[600px] rounded-xl bg-white px-8 py-10 shadow-sm">
            {marathonLogoUrl ? (
              <Section className="mb-6 text-center">
                <img
                  src={marathonLogoUrl}
                  alt={`${marathonName} logo`}
                  className="mx-auto max-h-16 rounded-md object-contain"
                />
              </Section>
            ) : null}

            <Heading className="m-0 mb-2 text-center text-3xl font-semibold text-slate-900">
              Jury review invitation
            </Heading>

            <Text className="m-0 mb-6 text-center text-sm text-slate-600">{marathonName}</Text>

            <Text className="mb-4 text-base leading-7 text-slate-700">
              Hello {juryMemberName},
            </Text>

            <Text className="mb-6 text-base leading-7 text-slate-700">
              You have been invited to review and rate submissions for {scopeLabel}. Use your
              personal link below to start the review before {expiresAtLabel}.
            </Text>

            {organizerNotes ? (
              <Section className="mb-6 rounded-xl bg-slate-50 px-5 py-4">
                <Text className="m-0 mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Instructions from the organizer
                </Text>
                <Text className="m-0 whitespace-pre-wrap text-sm leading-6 text-slate-800">
                  {organizerNotes}
                </Text>
              </Section>
            ) : null}

            <Section className="mb-8 text-center">
              <Button
                href={juryUrl}
                className="rounded-lg bg-slate-900 px-6 py-3 text-base font-semibold text-white no-underline"
              >
                Start jury review
              </Button>
            </Section>

            <Section className="mb-6 rounded-xl bg-slate-50 px-5 py-4">
              <Text className="m-0 mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Your personal review link
              </Text>
              <Text className="m-0 break-all text-sm leading-6 text-slate-800">{juryUrl}</Text>
            </Section>

            <Text className="mb-6 text-sm leading-6 text-slate-600">
              This link is personal to your jury session. Star ratings and notes are private review
              aids; you must also choose 1st, 2nd, and 3rd place before completing the review.
            </Text>

            <Hr className="my-6 border-slate-200" />

            <Text className="m-0 text-center text-xs text-slate-500">
              This is an automated message from Blikka for {marathonName}.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}

export function juryInviteEmailSubject(props: JuryInviteEmailProps): string {
  return `Jury review invitation for ${props.marathonName}`
}
