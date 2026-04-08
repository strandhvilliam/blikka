import { describe, expect, it } from "vitest";

import {
  getByCameraValidationWindow,
  getMarathonValidationWindow,
} from "./live-validation-window";

describe("live validation window", () => {
  it("uses marathon dates for marathon uploads", () => {
    expect(
      getMarathonValidationWindow({
        startDate: "2026-03-17T08:00:00.000Z",
        endDate: "2026-03-17T18:00:00.000Z",
      }),
    ).toEqual({
      validationStartDate: "2026-03-17T08:00:00.000Z",
      validationEndDate: "2026-03-17T18:00:00.000Z",
    });
  });

  it("uses active topic dates for by-camera uploads", () => {
    expect(
      getByCameraValidationWindow({
        scheduledStart: "2026-03-17T12:00:00.000Z",
        scheduledEnd: "2026-03-17T13:00:00.000Z",
      }),
    ).toEqual({
      validationStartDate: "2026-03-17T12:00:00.000Z",
      validationEndDate: "2026-03-17T13:00:00.000Z",
    });
  });
});
