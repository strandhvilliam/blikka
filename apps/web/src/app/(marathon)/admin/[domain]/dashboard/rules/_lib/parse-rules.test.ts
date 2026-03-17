import { describe, expect, it } from "vitest";
import type { RuleConfig } from "@blikka/db";
import { mapRulesToDbRules, parseRules } from "./parse-rules";

function createRuleConfig(overrides: Partial<RuleConfig>): RuleConfig {
  return {
    id: 1,
    createdAt: "2026-03-17T00:00:00.000Z",
    updatedAt: null,
    ruleKey: "allowed_file_types",
    marathonId: 1,
    params: null,
    severity: "error",
    enabled: true,
    ...overrides,
  };
}

describe("parseRules", () => {
  it("normalizes stored jpeg aliases to canonical jpg form", () => {
    const parsedRules = parseRules(
      [
        createRuleConfig({
          ruleKey: "allowed_file_types",
          params: {
            allowedFileTypes: ["jpeg"],
          },
        }),
      ],
      {},
    );

    expect(parsedRules.allowed_file_types.params.allowedFileTypes).toEqual([
      "jpg",
    ]);
  });

  it("deduplicates stored jpg and jpeg aliases when reading rules", () => {
    const parsedRules = parseRules(
      [
        createRuleConfig({
          ruleKey: "allowed_file_types",
          params: {
            allowedFileTypes: ["jpg", "jpeg"],
          },
        }),
      ],
      {},
    );

    expect(parsedRules.allowed_file_types.params.allowedFileTypes).toEqual([
      "jpg",
    ]);
  });
});

describe("mapRulesToDbRules", () => {
  it("serializes jpeg aliases as canonical jpg", () => {
    const dbRules = mapRulesToDbRules({
      max_file_size: {
        enabled: false,
        severity: "error",
        params: {
          maxBytes: 1024 * 1024 * 5,
        },
      },
      allowed_file_types: {
        enabled: true,
        severity: "error",
        params: {
          allowedFileTypes: ["jpeg"],
        },
      },
      within_timerange: {
        enabled: false,
        severity: "error",
        params: {
          start: "",
          end: "",
        },
      },
      same_device: {
        enabled: false,
        severity: "error",
        params: null,
      },
      modified: {
        enabled: false,
        severity: "error",
        params: null,
      },
      strict_timestamp_ordering: {
        enabled: false,
        severity: "error",
        params: null,
      },
    });

    expect(
      dbRules.find((rule) => rule.ruleKey === "allowed_file_types")?.params,
    ).toEqual({
      allowedFileTypes: ["jpg"],
    });
  });

  it("deduplicates jpg and jpeg aliases when writing rules", () => {
    const dbRules = mapRulesToDbRules({
      max_file_size: {
        enabled: false,
        severity: "error",
        params: {
          maxBytes: 1024 * 1024 * 5,
        },
      },
      allowed_file_types: {
        enabled: true,
        severity: "error",
        params: {
          allowedFileTypes: ["jpg", "jpeg"],
        },
      },
      within_timerange: {
        enabled: false,
        severity: "error",
        params: {
          start: "",
          end: "",
        },
      },
      same_device: {
        enabled: false,
        severity: "error",
        params: null,
      },
      modified: {
        enabled: false,
        severity: "error",
        params: null,
      },
      strict_timestamp_ordering: {
        enabled: false,
        severity: "error",
        params: null,
      },
    });

    expect(
      dbRules.find((rule) => rule.ruleKey === "allowed_file_types")?.params,
    ).toEqual({
      allowedFileTypes: ["jpg"],
    });
  });
});
