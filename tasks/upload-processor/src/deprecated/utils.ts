import { parseAndNormalizeMessage, parseJson, parseUploadObjectKey } from '@blikka/task-runtime'

export { parseAndNormalizeMessage, parseJson }
export const parseKey = parseUploadObjectKey

export const makeThumbnailKey = (params: {
  domain: string
  reference: string
  orderIndex: number
  fileName: string
}) => {
  const formattedOrderIndex = (params.orderIndex + 1).toString().padStart(2, '0')
  return `${params.domain}/${params.reference}/${formattedOrderIndex}/thumbnail_${params.fileName}`
}
