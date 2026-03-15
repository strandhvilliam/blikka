export const SEED_PREVIEW = {
  participants: 30,
  topics: 24,
  competitionClasses: 2,
  deviceGroups: 2,
} as const

export const SEED_TOPIC_NAMES = [
  "Reflection",
  "Motion",
  "Geometry",
  "Shadow",
  "Contrast",
  "Silence",
  "Repetition",
  "Window",
  "Red",
  "Texture",
  "Distance",
  "Water",
  "Pattern",
  "Threshold",
  "Story",
  "Street",
  "Symmetry",
  "Night",
  "Green",
  "Detail",
  "Waiting",
  "Energy",
  "Human",
  "Finale",
] as const

const FIRST_NAMES = [
  "Janne",
  "Alma",
  "Simon",
  "Jonas",
  "Anders",
  "Cecilia",
  "Maja",
  "Viktor",
  "Elin",
  "Ludvig",
] as const

const LAST_NAMES = ["Johansson", "Karlsson", "Larsson"] as const

export const SEED_COMBOS = [
  {
    key: "mobile-8",
    deviceGroupName: "Mobile",
    competitionClassName: "8 Images",
  },
  {
    key: "mobile-24",
    deviceGroupName: "Mobile",
    competitionClassName: "24 Images",
  },
  {
    key: "camera-8",
    deviceGroupName: "Digital Camera",
    competitionClassName: "8 Images",
  },
  {
    key: "camera-24",
    deviceGroupName: "Digital Camera",
    competitionClassName: "24 Images",
  },
] as const

export const SEED_JURY_INVITATIONS = [
  {
    comboKey: "mobile-8",
    status: "completed",
    progressRatio: 1,
    displayName: "Seed Jury Mobile 8",
    email: "seed-jury-mobile-8@example.test",
  },
  {
    comboKey: "camera-8",
    status: "in_progress",
    progressRatio: 0.5,
    displayName: "Seed Jury Camera 8",
    email: "seed-jury-camera-8@example.test",
  },
  {
    comboKey: "mobile-24",
    status: "in_progress",
    progressRatio: 0.35,
    displayName: "Seed Jury Mobile 24",
    email: "seed-jury-mobile-24@example.test",
  },
  {
    comboKey: "camera-24",
    status: "pending",
    progressRatio: 0,
    displayName: "Seed Jury Camera 24",
    email: "seed-jury-camera-24@example.test",
  },
] as const

export const SEED_VOTE_OFFSET = 7
export const SEED_VERIFIED_PARTICIPANT_COUNT = 22
export const SEED_VOTED_SESSION_COUNT = 18

export function getSeedParticipantNames(index: number) {
  const firstName = FIRST_NAMES[index % FIRST_NAMES.length]!
  const lastName = LAST_NAMES[Math.floor(index / FIRST_NAMES.length)]!

  return {
    firstname: firstName,
    lastname: lastName,
  }
}

export function getSeedReference(index: number) {
  return (1001 + index).toString()
}
