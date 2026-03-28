import React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { Tailwind } from "@react-email/tailwind";

export interface MarathonVerificationEmailProps {
  participantName: string;
  participantReference: string;
  marathonName: string;
  marathonLogoUrl?: string | null;
}

export function MarathonVerificationEmail({
  participantName,
  participantReference,
  marathonName,
  marathonLogoUrl,
}: MarathonVerificationEmailProps) {
  const previewText = `Your submission for ${marathonName} has been verified.`;

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
              Submission verified
            </Heading>

            <Text className="m-0 mb-6 text-center text-sm text-slate-600">
              {marathonName}
            </Text>

            <Text className="mb-4 text-base leading-7 text-slate-700">
              Hello {participantName},
            </Text>

            <Text className="mb-6 text-base leading-7 text-slate-700">
              Thank you for participating in <strong>{marathonName}</strong>.
              Your submission has now been verified by the event team.
            </Text>

            <Section className="mb-6 rounded-xl bg-slate-50 px-5 py-4">
              <Text className="m-0 mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Confirmation
              </Text>
              <Text className="m-0 text-base text-slate-800">
                Reference: <strong>#{participantReference}</strong>
              </Text>
            </Section>

            <Text className="mb-6 text-base leading-7 text-slate-700">
              We will contact you if there are further updates related to your
              participation.
            </Text>

            <Hr className="my-6 border-slate-200" />

            <Text className="m-0 text-center text-xs text-slate-500">
              This is an automated message from Blikka for {marathonName}.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export function marathonVerificationEmailSubject(
  props: MarathonVerificationEmailProps,
): string {
  return `Your submission for ${props.marathonName} is verified`;
}
