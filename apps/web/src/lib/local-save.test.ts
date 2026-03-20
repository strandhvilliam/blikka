import { describe, expect, it } from "vitest";

import {
  buildLocalSaveEntries,
  buildLocalSavePath,
  formatTopicOrderIndex,
  getCollisionSafeFileName,
  supportsDirectoryPicker,
} from "./local-save";

describe("participant-upload local save helpers", () => {
  it("formats topic order indexes with two digits", () => {
    expect(formatTopicOrderIndex(0)).toBe("00");
    expect(formatTopicOrderIndex(7)).toBe("07");
    expect(formatTopicOrderIndex(12)).toBe("12");
  });

  it("builds the expected local save path structure", () => {
    expect(
      buildLocalSavePath({
        domain: "vimmer",
        participantReference: "0042",
        orderIndex: 3,
        fileName: "frame.jpg",
      }),
    ).toEqual({
      path: "vimmer/0042/03/frame.jpg",
      pathSegments: ["vimmer", "0042", "03", "frame.jpg"],
    });
  });

  it("builds one save entry per selected photo", () => {
    const entries = buildLocalSaveEntries({
      domain: "demo",
      participantReference: "0007",
      photos: [
        { orderIndex: 0, file: { name: "a.jpg" } },
        { orderIndex: 11, file: { name: "b.jpg" } },
      ],
    });

    expect(entries.map((entry) => entry.path)).toEqual([
      "demo/0007/00/a.jpg",
      "demo/0007/11/b.jpg",
    ]);
  });

  it("creates collision-safe file names without overwriting", () => {
    const existingNames = new Set(["frame.jpg", "frame-1.jpg"]);

    expect(getCollisionSafeFileName("frame.jpg", existingNames)).toBe(
      "frame-2.jpg",
    );
    expect(getCollisionSafeFileName("fresh.jpg", existingNames)).toBe(
      "fresh.jpg",
    );
  });

  it("detects directory picker support", () => {
    expect(supportsDirectoryPicker({ showDirectoryPicker: async () => ({}) as never })).toBe(
      true,
    );
    expect(supportsDirectoryPicker({})).toBe(false);
  });
});
