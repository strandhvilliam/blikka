import type { Accept } from "react-dropzone"

const ADMIN_REPLACE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
] as const

type AdminReplaceContentType = (typeof ADMIN_REPLACE_CONTENT_TYPES)[number]

const CONTENT_TYPE_BY_EXTENSION: Record<string, AdminReplaceContentType> = {
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
}

export const ADMIN_REPLACE_DROPZONE_ACCEPT: Accept = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/gif": [".gif"],
  "image/webp": [".webp"],
  "image/heic": [".heic"],
  "image/heif": [".heif"],
}

export function resolveReplaceUploadContentType(file: {
  type?: string | null
  name: string
}): AdminReplaceContentType | null {
  if (file.type === "image/jpg") {
    return "image/jpeg"
  }

  if (file.type && file.type in ADMIN_REPLACE_DROPZONE_ACCEPT) {
    return file.type as AdminReplaceContentType
  }

  const extension = file.name.split(".").pop()?.toLowerCase()
  if (!extension) {
    return null
  }

  return CONTENT_TYPE_BY_EXTENSION[extension] ?? null
}
