import { groupJuryResultsByScope, type JuryDomainResult, type JuryScopeGroup } from './jury-results'
import { compareParticipantReferences } from './jury-utils'

/** Which rendition of a pick goes into the archive. */
export type JuryImageSize = 'original' | 'preview'

export type JuryImageBucket = 'submissions' | 'thumbnails' | 'contact-sheets'

export interface JuryImageArchiveFile {
  bucket: JuryImageBucket
  key: string
  path: string
}

export interface JuryImageArchiveTextFile {
  path: string
  content: string
}

export interface JuryImageArchivePlan {
  rootFolder: string
  files: JuryImageArchiveFile[]
  textFiles: JuryImageArchiveTextFile[]
  /** Zip entries holding an image; the same photo picked by two jurors counts twice. */
  entryCount: number
  /** Objects actually fetched from S3 — an entry every juror picked is downloaded once. */
  distinctObjectCount: number
}

export interface JuryImageArchiveOptions {
  domain: string
  dateStamp: string
  size: JuryImageSize
  /** Restricts the archive to one juror or one scope without renumbering the rest. */
  filter?: { invitationId?: number; scopeKey?: string }
  /** Written into the archive as `jury-results.csv` when given. */
  csv?: string
}

/**
 * Filename-safe segment. The export lib's `sanitizeFilenameSegment` hardcodes an 'active-topic'
 * fallback, which means nothing here — every segment in this archive has its own.
 */
function slug(value: string | null | undefined, fallback: string): string {
  const sanitized = (value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return sanitized || fallback
}

/** Participant names run long; the reference in front of them is what identifies the entry. */
function nameSlug(participant: { firstname: string; lastname: string }): string {
  const sanitized = slug(`${participant.firstname} ${participant.lastname}`, '')
  return sanitized.slice(0, 40).replace(/-+$/, '')
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function fileExtension(key: string): string {
  const match = /\.[a-z0-9]+$/i.exec(key)
  return match ? match[0].toLowerCase() : '.jpg'
}

/**
 * A scope folder has to say what kind of scope it is: `youth-mobile` and a topic named "Youth" are
 * indistinguishable otherwise, and an organizer sorting through folders can't tell whether they are
 * looking at single photos or contact sheets.
 */
function scopeFolderName(group: JuryScopeGroup, index: number): string {
  const juror = group.jurors[0]
  const prefix = pad2(index + 1)

  if (!juror) return `${prefix}-scope`

  if (juror.inviteType === 'topic' && juror.topic) {
    return `${prefix}-topic-${slug(juror.topic.name, `topic-${juror.topic.orderIndex + 1}`)}`
  }

  if (juror.inviteType === 'class' && juror.competitionClass) {
    const className = slug(juror.competitionClass.name, 'class')
    const deviceGroup = juror.deviceGroup ? `-${slug(juror.deviceGroup.name, 'device-group')}` : ''
    return `${prefix}-class-${className}${deviceGroup}`
  }

  // 'all', 'custom' and 'device' invites resolve to neither a topic nor a class, so the folder names
  // the invite the way the CSV's scope column does rather than mislabelling it as a class.
  return `${prefix}-${slug(juror.inviteType, 'invite')}-${slug(juror.displayName, 'juror')}`
}

/** Winner first — the shortlist itself carries no ranking, so the rest go by reference. */
function sortPicksForExport(shortlist: JuryDomainResult['shortlist']) {
  return shortlist.toSorted((left, right) => {
    if (left.isWinner !== right.isWinner) return left.isWinner ? -1 : 1
    return compareParticipantReferences(left.participant, right.participant)
  })
}

interface ResolvedImage {
  bucket: JuryImageBucket
  key: string
  isContactSheet: boolean
}

/**
 * Class invites judge a contact sheet, which has no thumbnail rendition, so preview mode falls back
 * to the sheet itself the same way the admin result views do.
 */
function resolveImage(
  participant: JuryDomainResult['shortlist'][number]['participant'],
  size: JuryImageSize,
): ResolvedImage | null {
  if (participant.contactSheetKey) {
    return { bucket: 'contact-sheets', key: participant.contactSheetKey, isContactSheet: true }
  }

  if (size === 'preview' && participant.submissionThumbnailKey) {
    return {
      bucket: 'thumbnails',
      key: participant.submissionThumbnailKey,
      isContactSheet: false,
    }
  }

  if (participant.submissionKey) {
    return { bucket: 'submissions', key: participant.submissionKey, isContactSheet: false }
  }

  return null
}

interface PlanNotes {
  scopes: number
  jurors: number
  jurorsWithNoPicks: string[]
  unavailable: string[]
}

function buildReadme(
  options: JuryImageArchiveOptions,
  notes: PlanNotes,
  plan: Pick<JuryImageArchivePlan, 'entryCount' | 'distinctObjectCount'>,
): string {
  const lines = [
    `Jury result images — ${options.domain}`,
    `Generated ${options.dateStamp}`,
    '',
    'LAYOUT',
    '  <scope>/<juror>/<NN>-<winner|shortlist>-<reference>-<name>.<ext>',
    '',
    '  Scope folders are numbered in competition order (topics first, then classes), juror folders',
    '  alphabetically within a scope, and files winner-first then by participant reference — the',
    '  same order as jury-results.csv and the Jury Results tab in the dashboard.',
    '',
    '  A class invite judges a contact sheet rather than a single photo. Those files carry a',
    '  -contact-sheet suffix so they are not mistaken for the winning frame.',
    '',
    '  The numbers are taken from the whole jury, so a single-juror download drops into the same',
    '  folders as the full export instead of renumbering itself.',
    '',
    'CONTENTS',
    `  Scopes: ${notes.scopes}`,
    `  Jurors: ${notes.jurors}`,
    `  Images: ${plan.entryCount} (${plan.distinctObjectCount} distinct photos)`,
    `  Size: ${options.size === 'preview' ? 'preview renditions' : 'original files'}`,
  ]

  if (notes.jurorsWithNoPicks.length > 0) {
    lines.push(
      '',
      'JURORS WITH NO PICKS',
      '  These jurors have decided nothing yet. Their folder holds a no-picks.txt marker so an',
      '  empty shortlist cannot be read as a failed export.',
      ...notes.jurorsWithNoPicks.map((entry) => `  ${entry}`),
    )
  }

  if (notes.unavailable.length > 0) {
    lines.push(
      '',
      'IMAGES NOT AVAILABLE',
      '  These picks have no image on record — an invite scoped to neither a topic nor a class, or',
      '  a contact sheet that was never generated. They are in jury-results.csv all the same.',
      ...notes.unavailable.map((entry) => `  ${entry}`),
    )
  }

  lines.push(
    '',
    'If any photo could not be read at export time, the archive also holds missing-files.txt.',
    '',
  )

  return lines.join('\n')
}

/**
 * Lays out the jury verdict as an archive: one folder per scope, one per juror inside it, and the
 * juror's shortlist as files with the winner first. The plan is pure — it names every entry and the
 * object behind it, and the export service does the fetching.
 */
export function buildJuryImageArchivePlan(
  results: readonly JuryDomainResult[],
  options: JuryImageArchiveOptions,
): JuryImageArchivePlan {
  const rootFolder = `jury-result-images-${slug(options.domain, 'marathon')}-${options.dateStamp}`
  const files: JuryImageArchiveFile[] = []
  const textFiles: JuryImageArchiveTextFile[] = []
  const distinctKeys = new Set<string>()
  const notes: PlanNotes = { scopes: 0, jurors: 0, jurorsWithNoPicks: [], unavailable: [] }

  // Indices come from the full jury even when the download is filtered, so two partial exports
  // unzip into one consistent tree.
  for (const [scopeIndex, group] of groupJuryResultsByScope([...results]).entries()) {
    if (options.filter?.scopeKey !== undefined && options.filter.scopeKey !== group.key) {
      continue
    }

    const scopeFolder = scopeFolderName(group, scopeIndex)

    let scopeIncluded = false

    for (const [jurorIndex, juror] of group.jurors.entries()) {
      if (
        options.filter?.invitationId !== undefined &&
        options.filter.invitationId !== juror.invitationId
      ) {
        continue
      }

      const jurorFolder = `${scopeFolder}/${pad2(jurorIndex + 1)}-${slug(juror.displayName, 'juror')}`
      scopeIncluded = true
      notes.jurors += 1

      const picks = sortPicksForExport(juror.shortlist)

      if (picks.length === 0) {
        textFiles.push({
          path: `${rootFolder}/${jurorFolder}/no-picks.txt`,
          content: `${juror.displayName} <${juror.email}> has not picked anything yet.\n`,
        })
        notes.jurorsWithNoPicks.push(jurorFolder)
        continue
      }

      for (const [pickIndex, pick] of picks.entries()) {
        const image = resolveImage(pick.participant, options.size)
        const reference = pick.participant.reference.padStart(4, '0')

        if (!image) {
          notes.unavailable.push(
            `${jurorFolder} — #${pick.participant.reference} ${pick.participant.firstname} ${pick.participant.lastname}`.trimEnd(),
          )
          continue
        }

        const name = nameSlug(pick.participant)
        const filename = [
          pad2(pickIndex + 1),
          pick.isWinner ? 'winner' : 'shortlist',
          reference,
          name,
          image.isContactSheet ? 'contact-sheet' : '',
        ]
          .filter(Boolean)
          .join('-')

        files.push({
          bucket: image.bucket,
          key: image.key,
          path: `${rootFolder}/${jurorFolder}/${filename}${fileExtension(image.key)}`,
        })
        distinctKeys.add(`${image.bucket}:${image.key}`)
      }
    }

    if (scopeIncluded) {
      notes.scopes += 1
    }
  }

  const counts = { entryCount: files.length, distinctObjectCount: distinctKeys.size }

  if (options.csv !== undefined) {
    textFiles.push({ path: `${rootFolder}/jury-results.csv`, content: options.csv })
  }

  textFiles.push({
    path: `${rootFolder}/README.txt`,
    content: buildReadme(options, notes, counts),
  })

  return { rootFolder, files, textFiles, ...counts }
}
