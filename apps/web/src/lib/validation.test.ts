import { afterEach, describe, expect, it, vi } from "vitest";

function mockValidationDependencies() {
  vi.doMock(
    "effect",
    () => ({
      Effect: {
        gen: (fn: () => unknown) => fn(),
      },
    }),
    { virtual: true },
  );
  vi.doMock(
    "@blikka/validation",
    () => ({
      RULE_KEYS: {
        WITHIN_TIMERANGE: "within_timerange",
      },
      VALIDATION_OUTCOME: {
        FAILED: "failed",
        PASSED: "passed",
      },
      ValidationEngine: {},
      ValidationInput: {},
    }),
    { virtual: true },
  );
  vi.doMock("./client-runtime", () => ({
    clientRuntime: {
      runPromise: vi.fn(),
    },
  }));
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.doUnmock("effect");
  vi.doUnmock("@blikka/validation");
  vi.doUnmock("./client-runtime");
});

describe("validation helpers", () => {
  it("builds validation inputs from photo-like objects", async () => {
    mockValidationDependencies();
    const { buildValidationInputs } = await import("./validation");

    expect(
      buildValidationInputs([
        {
          exif: { DateTimeOriginal: "2024-01-01T00:00:00.000Z" },
          file: {
            name: "photo.jpg",
            size: 123,
            type: "image/jpeg",
          },
          orderIndex: 7,
        },
      ]),
    ).toEqual([
      {
        exif: { DateTimeOriginal: "2024-01-01T00:00:00.000Z" },
        fileName: "photo.jpg",
        fileSize: 123,
        orderIndex: 7,
        mimeType: "image/jpeg",
      },
    ]);
  });

  it("creates stable validation result keys", async () => {
    mockValidationDependencies();
    const { VALIDATION_OUTCOME } = await import("@blikka/validation");
    const { createValidationResultKey } = await import("./validation");

    const result = {
      ruleKey: "within_timerange",
      message: "Outside allowed time range",
      outcome: VALIDATION_OUTCOME.FAILED,
      severity: "error",
      orderIndex: 2,
      fileName: "photo.jpg",
      isGeneral: false,
    };

    expect(createValidationResultKey(result as never)).toBe(
      "within_timerange|Outside allowed time range|failed|error|2|photo.jpg|file",
    );
  });

  it("splits blocking and warning results", async () => {
    mockValidationDependencies();
    const { VALIDATION_OUTCOME } = await import("@blikka/validation");
    const { splitValidationResultsBySeverity } = await import("./validation");

    const results = [
      {
        ruleKey: "within_timerange",
        message: "Blocking",
        outcome: VALIDATION_OUTCOME.FAILED,
        severity: "error",
        isGeneral: false,
      },
      {
        ruleKey: "camera_model",
        message: "Warning",
        outcome: VALIDATION_OUTCOME.FAILED,
        severity: "warning",
        isGeneral: false,
      },
      {
        ruleKey: "camera_model",
        message: "Passed",
        outcome: VALIDATION_OUTCOME.PASSED,
        severity: "warning",
        isGeneral: false,
      },
    ];

    const split = splitValidationResultsBySeverity(results as never);

    expect(split.blocking).toHaveLength(1);
    expect(split.warnings).toHaveLength(1);
  });

  it("maps photo validation results by order index or file name", async () => {
    mockValidationDependencies();
    const { VALIDATION_OUTCOME } = await import("@blikka/validation");
    const { buildPhotoValidationMap } = await import("./validation");

    const results = [
      {
        ruleKey: "within_timerange",
        message: "Order match",
        outcome: VALIDATION_OUTCOME.FAILED,
        severity: "error",
        orderIndex: 1,
        isGeneral: false,
      },
      {
        ruleKey: "camera_model",
        message: "File match",
        outcome: VALIDATION_OUTCOME.FAILED,
        severity: "warning",
        fileName: "second.jpg",
        isGeneral: false,
      },
      {
        ruleKey: "camera_model",
        message: "General",
        outcome: VALIDATION_OUTCOME.FAILED,
        severity: "warning",
        isGeneral: true,
      },
    ];

    const map = buildPhotoValidationMap(
      [
        {
          id: "one",
          orderIndex: 1,
          file: { name: "first.jpg" },
        },
        {
          id: "two",
          orderIndex: 2,
          file: { name: "second.jpg" },
        },
      ],
      results as never,
    );

    expect(map.get("one")?.map((result) => result.message)).toEqual([
      "Order match",
    ]);
    expect(map.get("two")?.map((result) => result.message)).toEqual([
      "File match",
    ]);
  });
});
