export type ParticipantExistenceStatus =
  | "prepared"
  | "initialized"
  | "completed"
  | "verified"
  | null;

export interface ParticipantExistenceResult {
  exists: boolean;
  status: ParticipantExistenceStatus;
}

export type StaffLaptopUploadLookupOutcome =
  | { kind: "manual-entry" }
  | { kind: "existing"; requiresOverwriteWarning: boolean }
  | { kind: "blocked"; reason: "completed" | "verified" };

export function resolveStaffLaptopUploadLookupOutcome(
  result: ParticipantExistenceResult,
): StaffLaptopUploadLookupOutcome {
  if (!result.exists) {
    return { kind: "manual-entry" };
  }

  if (result.status === "completed") {
    return { kind: "blocked", reason: "completed" };
  }

  if (result.status === "verified") {
    return { kind: "blocked", reason: "verified" };
  }

  return {
    kind: "existing",
    requiresOverwriteWarning: result.status === "initialized",
  };
}

