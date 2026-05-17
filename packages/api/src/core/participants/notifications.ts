import { Effect } from "effect";
import {
  EmailService,
  MarathonVerificationEmail,
  marathonVerificationEmailSubject,
} from "@blikka/email";

interface SendParticipantVerifiedEmailParams {
  participantEmail: string | null | undefined;
  participantFirstName: string;
  participantLastName: string;
  participantReference: string;
  marathonName: string;
  marathonLogoUrl?: string | null;
  marathonMode: string;
}

function getParticipantDisplayName({
  participantFirstName,
  participantLastName,
}: {
  participantFirstName: string;
  participantLastName: string;
}) {
  const fullName = `${participantFirstName} ${participantLastName}`.trim();
  return participantFirstName.trim() || fullName || "participant";
}

function normalizeEmail(email: string | null | undefined) {
  const trimmed = email?.trim();
  return trimmed ? trimmed : null;
}

export const sendParticipantVerifiedEmail = Effect.fn(
  "ParticipantsNotifications.sendParticipantVerifiedEmail",
)(function* ({
  participantEmail,
  participantFirstName,
  participantLastName,
  participantReference,
  marathonName,
  marathonLogoUrl,
  marathonMode,
}: SendParticipantVerifiedEmailParams) {
  if (marathonMode !== "marathon") {
    return false;
  }

  const email = normalizeEmail(participantEmail);
  if (!email) {
    return false;
  }

  const participantName = getParticipantDisplayName({
    participantFirstName,
    participantLastName,
  });

  const emailService = yield* EmailService;

  return yield* (
    emailService
      .send({
        to: email,
        subject: marathonVerificationEmailSubject({
          participantName,
          participantReference,
          marathonName,
          marathonLogoUrl,
        }),
        template: MarathonVerificationEmail({
          participantName,
          participantReference,
          marathonName,
          marathonLogoUrl,
        }),
        tags: [
          { name: "category", value: "participant-verification" },
          { name: "marathon", value: marathonName },
        ],
      })
      .pipe(
        Effect.as(true),
        Effect.catch((error) =>
          Effect.logError("Failed to send participant verification email", error).pipe(
            Effect.as(false),
          ),
        ),
      )
  );
});
