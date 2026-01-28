export const PARTICIPANT_SUBMISSION_STEPS = {
  ParticipantNumberStep: 1,
  ParticipantDetailsStep: 2,
  ClassSelectionStep: 3,
  DeviceSelectionStep: 4,
  UploadSubmissionStep: 5,
} as const;

export const PARTICIPANT_REF_LENGTH = 4;


export const COMMON_IMAGE_EXTENSIONS = [
  "jpg",
  "jpeg",
  "heic",
  "heif",
  "png",
  "gif",
  "webp",
];


export const UPLOAD_TIMEOUT_MS = 1000 * 60 * 6; // 6 minutes
export const UPLOAD_CONCURRENCY_LIMIT = 1;
export const POLLING_INTERVAL_MS = 3000; // 3 seconds