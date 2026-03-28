import React from "react";
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
} from "@react-email/components";
import { Tailwind } from "@react-email/tailwind";

export interface VotingInviteEmailProps {
  participantName: string;
  marathonName: string;
  votingUrl: string;
  marathonLogoUrl?: string | null;
  topicName?: string | null;
}

export function VotingInviteEmail({
  participantName,
  marathonName,
  votingUrl,
  marathonLogoUrl,
  topicName,
}: VotingInviteEmailProps) {
  const previewText = `Voting is now open for ${marathonName}.`;
  const intro = topicName
    ? `Voting is now open for ${topicName} in ${marathonName}.`
    : `Voting is now open for ${marathonName}.`;

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
              Voting is open
            </Heading>

            <Text className="m-0 mb-6 text-center text-sm text-slate-600">
              {marathonName}
            </Text>

            <Text className="mb-4 text-base leading-7 text-slate-700">
              Hello {participantName},
            </Text>

            <Text className="mb-6 text-base leading-7 text-slate-700">
              {intro} Use your personal voting link below to cast your vote.
            </Text>

            <Section className="mb-8 text-center">
              <Button
                href={votingUrl}
                className="rounded-lg bg-slate-900 px-6 py-3 text-base font-semibold text-white no-underline"
              >
                Open voting
              </Button>
            </Section>

            <Section className="mb-6 rounded-xl bg-slate-50 px-5 py-4">
              <Text className="m-0 mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Your personal voting link
              </Text>
              <Text className="m-0 break-all text-sm leading-6 text-slate-800">
                {votingUrl}
              </Text>
            </Section>

            <Text className="mb-6 text-sm leading-6 text-slate-600">
              This link is personal to your voting session. Please use this
              email to access the voting page.
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

export function votingInviteEmailSubject(
  props: VotingInviteEmailProps,
): string {
  return `Voting is now open for ${props.marathonName}`;
}
