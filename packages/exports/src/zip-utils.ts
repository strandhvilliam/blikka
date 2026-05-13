import type { Participant } from "@blikka/db";

export function makeZipKey(domain: string, reference: string) {
  return `${domain}/${reference}.zip`;
}

export function makeZippedSubmissionDto(
  domain: string,
  participant: Participant,
) {
  return {
    data: {
      marathonId: participant.marathonId,
      participantId: participant.id,
      key: makeZipKey(domain, participant.reference),
      exportType: "zip",
      progress: 100,
      status: "completed",
      errors: [],
    },
  };
}
