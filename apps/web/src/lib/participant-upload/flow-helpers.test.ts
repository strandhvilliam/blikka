import { describe, expect, it } from "vitest";

import { resolveStaffLaptopUploadLookupOutcome } from "./flow-helpers";

describe("participant-upload flow helpers", () => {
  it("routes missing participants to manual entry", () => {
    expect(
      resolveStaffLaptopUploadLookupOutcome({
        exists: false,
        status: null,
      }),
    ).toEqual({ kind: "manual-entry" });
  });

  it("routes prepared participants to the existing-participant path", () => {
    expect(
      resolveStaffLaptopUploadLookupOutcome({
        exists: true,
        status: "prepared",
      }),
    ).toEqual({
      kind: "existing",
      requiresOverwriteWarning: false,
    });
  });

  it("marks initialized participants for overwrite confirmation", () => {
    expect(
      resolveStaffLaptopUploadLookupOutcome({
        exists: true,
        status: "initialized",
      }),
    ).toEqual({
      kind: "existing",
      requiresOverwriteWarning: true,
    });
  });

  it("blocks completed and verified participants", () => {
    expect(
      resolveStaffLaptopUploadLookupOutcome({
        exists: true,
        status: "completed",
      }),
    ).toEqual({
      kind: "blocked",
      reason: "completed",
    });

    expect(
      resolveStaffLaptopUploadLookupOutcome({
        exists: true,
        status: "verified",
      }),
    ).toEqual({
      kind: "blocked",
      reason: "verified",
    });
  });
});

