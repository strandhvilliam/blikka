import { Array } from 'effect'

import { chunkItems } from '../shared/chunk-items'

export function competitionClassSlug(name: string): string {
  return name.toLowerCase().replace(/ /g, '-')
}

export interface ZipChunkJobPlan {
  readonly competitionClassId: number
  readonly competitionClassName: string
  readonly classTotalChunks: number
  readonly chunkIndex: number
  readonly minParticipantReference: string
  readonly maxParticipantReference: string
  readonly zipKey: string
}

export interface CompetitionClassPlan {
  readonly competitionClassId: number
  readonly competitionClassName: string
  readonly totalChunks: number
}

export interface ZipDownloadPlan {
  readonly competitionClasses: readonly CompetitionClassPlan[]
  readonly chunkJobs: readonly ZipChunkJobPlan[]
  readonly totalChunksAcrossAllClasses: number
}

interface ZipWithCompetitionClass {
  readonly participant: {
    readonly reference: string
    readonly competitionClass: { readonly id: number; readonly name: string }
  }
}

export function planZipDownload(
  domain: string,
  zips: readonly ZipWithCompetitionClass[],
  maxParticipantsPerZip: number,
): ZipDownloadPlan {
  const byCompetitionClass = Array.groupBy(zips, (zip) =>
    zip.participant.competitionClass.id.toString(),
  )

  const competitionClasses: CompetitionClassPlan[] = []
  const chunkJobs: ZipChunkJobPlan[] = []
  let totalChunksAcrossAllClasses = 0

  for (const classZips of Object.values(byCompetitionClass)) {
    if (classZips.length === 0) {
      continue
    }

    const sortedZips = [...classZips].sort(
      (a, b) => Number(a.participant.reference) - Number(b.participant.reference),
    )
    const chunks = chunkItems(sortedZips, maxParticipantsPerZip)
    const competitionClassId = classZips[0].participant.competitionClass.id
    const competitionClassName = competitionClassSlug(
      classZips[0].participant.competitionClass.name,
    )

    competitionClasses.push({
      competitionClassId,
      competitionClassName,
      totalChunks: chunks.length,
    })
    totalChunksAcrossAllClasses += chunks.length

    for (let index = 0; index < chunks.length; index++) {
      const chunk = chunks[index]
      if (chunk.length === 0) {
        continue
      }

      const minParticipantReference = chunk[0].participant.reference
      const maxParticipantReference = chunk[chunk.length - 1].participant.reference
      const minRefPadded = minParticipantReference.padStart(4, '0')
      const maxRefPadded = maxParticipantReference.padStart(4, '0')

      chunkJobs.push({
        competitionClassId,
        competitionClassName,
        classTotalChunks: chunks.length,
        chunkIndex: index,
        minParticipantReference,
        maxParticipantReference,
        zipKey: `${domain}/zip-downloads/${competitionClassName}/${minRefPadded}-${maxRefPadded}.zip`,
      })
    }
  }

  return {
    competitionClasses,
    chunkJobs,
    totalChunksAcrossAllClasses,
  }
}
