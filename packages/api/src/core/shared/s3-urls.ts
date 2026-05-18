const AWS_S3_EU_NORTH_BASE_URL = 'https://s3.eu-north-1.amazonaws.com'

/** Encodes each path segment for virtual-hosted–style S3 URLs. */
export function encodeS3ObjectKeyForUrl(key: string) {
  return key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

/** `https://{bucket}.s3.eu-north-1.amazonaws.com/{encodedKey}` */
export function buildVirtualHostedS3Url(
  bucketName: string,
  key: string | null | undefined,
): string | undefined {
  if (!key) {
    return undefined
  }

  return `https://${bucketName}.s3.eu-north-1.amazonaws.com/${encodeS3ObjectKeyForUrl(key)}`
}

/** `https://s3.eu-north-1.amazonaws.com/{bucket}/{key}` */
export function buildPathStyleS3Url(
  bucketName: string,
  key: string | null | undefined,
): string | undefined {
  if (!key) {
    return undefined
  }

  return `${AWS_S3_EU_NORTH_BASE_URL}/${bucketName}/${key}`
}
