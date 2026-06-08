import React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import { Tailwind } from '@react-email/tailwind'

const BLIKKA_LOGO_URL = 'https://blikka.app/blikka-logo-white.svg'

export interface ContactSheetReadyEmailProps {
  participantName: string
  participantReference: string
  marathonName: string
  contactSheetFilename: string
  photoCount: number
  blikkaLogoUrl?: string
  marathonLogoUrl?: string | null
}

export function ContactSheetReadyEmail({
  participantName,
  participantReference,
  marathonName,
  contactSheetFilename,
  photoCount,
  blikkaLogoUrl = BLIKKA_LOGO_URL,
  marathonLogoUrl,
}: ContactSheetReadyEmailProps) {
  const previewText = `Your ${marathonName} contact sheet is attached.`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-[#f4f1ec] font-sans py-10">
          <Container className="mx-auto max-w-[620px] overflow-hidden rounded-xl bg-white shadow-sm">
            <Section className="bg-[#111111] px-8 py-7">
              <Img src={blikkaLogoUrl} alt="Blikka" className="h-8 w-auto" />
            </Section>

            <Section className="px-8 pb-9 pt-8">
              {marathonLogoUrl ? (
                <Section className="mb-6 text-center">
                  <Img
                    src={marathonLogoUrl}
                    alt={`${marathonName} logo`}
                    className="mx-auto max-h-16 rounded-md object-contain"
                  />
                </Section>
              ) : null}

              <Text
                className="m-0 mb-3 text-xs font-semibold uppercase text-[#807568]"
                style={{ letterSpacing: '0.16em' }}
              >
                Contact sheet ready
              </Text>

              <Heading className="m-0 mb-4 text-3xl font-semibold leading-tight text-[#151515]">
                Your photos are gathered in one sheet.
              </Heading>

              <Text className="mb-4 text-base leading-7 text-[#4f4a43]">
                Hello {participantName},
              </Text>

              <Text className="mb-6 text-base leading-7 text-[#4f4a43]">
                Your contact sheet for {marathonName} has been generated and attached to this email.
                It includes {photoCount} photos from participant reference{' '}
                <strong>{participantReference}</strong>.
              </Text>

              <Section className="mb-6 rounded-lg border border-[#e7dfd4] bg-[#fbf7f1] px-5 py-4">
                <Text className="m-0 mb-1 text-sm font-semibold text-[#151515]">Attached file</Text>
                <Text className="m-0 text-sm leading-6 text-[#5f564d]">{contactSheetFilename}</Text>
              </Section>

              <Text className="mb-7 text-sm leading-6 text-[#6e665d]">
                Keep this email if you want an easy overview of your submitted photos.
              </Text>

              <Hr className="my-6 border-[#e7dfd4]" />

              <Text className="m-0 text-center text-xs text-[#8b8277]">
                Sent by Blikka for {marathonName}.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}

export function contactSheetReadyEmailSubject(props: ContactSheetReadyEmailProps): string {
  return `Your ${props.marathonName} contact sheet is ready`
}
