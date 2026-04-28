import { describe, expect, it } from "vitest"

import { formatByCameraAllTopicsParticipantRows } from "./by-camera-participants-export"

describe("formatByCameraAllTopicsParticipantRows", () => {
  it("includes contact details and latest topic participation summary", () => {
    const rows = formatByCameraAllTopicsParticipantRows([
      {
        reference: "A001",
        firstname: "Ada",
        lastname: "Lovelace",
        email: "ada@example.com",
        phoneNumber: "+4512345678",
        status: "initialized",
        competitionClassName: "Open",
        deviceGroupName: "iPhone",
        createdAt: "2026-04-01T08:00:00.000Z",
        topicsParticipatedCount: 2,
        latestTopicName: "Evening",
        latestUploadedAt: "2026-04-02T18:30:00.000Z",
      },
    ])

    expect(rows).toEqual([
      {
        Reference: "A001",
        "First Name": "Ada",
        "Last Name": "Lovelace",
        Email: "ada@example.com",
        "Phone Number": "+4512345678",
        Status: "initialized",
        "Competition Class": "Open",
        "Device Group": "iPhone",
        "Created At": "4/1/2026",
        "Topics Participated In": 2,
        "Latest Topic": "Evening",
        "Latest Uploaded": "2026-04-02 18:30",
      },
    ])
  })
})
