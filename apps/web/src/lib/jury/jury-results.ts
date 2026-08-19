import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@blikka/api/trpc'
import { compareParticipantReferences } from './jury-utils'

type RouterOutputs = inferRouterOutputs<AppRouter>

/** One juror's verdict for the scope they were invited to review. */
export type JuryDomainResult = RouterOutputs['jury']['getJuryResultsByDomain'][number]
export type JuryResultParticipantSummary = NonNullable<JuryDomainResult['winner']>

/** How often an entry was picked across the jurors reviewing one scope. */
export interface JuryConsensusEntry {
  participant: JuryResultParticipantSummary
  shortlistedBy: number
  wonBy: number
}

/** The jurors who reviewed the same topic or class, and where they agreed. */
export interface JuryScopeGroup {
  key: string
  label: string
  jurors: JuryDomainResult[]
  consensus: JuryConsensusEntry[]
}

/**
 * Two invitations belong together when they put the same photos in front of the juror. For a class
 * invite that means the device group counts too — a class split across device groups is two
 * different reviews, not one.
 */
export function getJuryScopeKey(result: JuryDomainResult): string {
  if (result.inviteType === 'topic') {
    return result.topic ? `topic:${result.topic.id}` : `invitation:${result.invitationId}`
  }

  if (!result.competitionClass) {
    return `invitation:${result.invitationId}`
  }

  return `class:${result.competitionClass.id}:${result.deviceGroup?.id ?? 'all'}`
}

export function getJuryScopeLabel(result: JuryDomainResult): string {
  if (result.inviteType === 'topic') {
    return result.topic ? `Topic ${result.topic.orderIndex + 1}: ${result.topic.name}` : 'Topic'
  }

  const className = result.competitionClass?.name ?? 'Class'
  return result.deviceGroup ? `${className} · ${result.deviceGroup.name}` : className
}

/** Topics run in competition order and come before classes, which are alphabetical. */
function compareScopes(left: JuryScopeGroup, right: JuryScopeGroup): number {
  const leftTopic = left.jurors[0]?.topic
  const rightTopic = right.jurors[0]?.topic

  if (leftTopic && rightTopic) {
    return leftTopic.orderIndex - rightTopic.orderIndex
  }
  if (leftTopic) return -1
  if (rightTopic) return 1

  return left.label.localeCompare(right.label)
}

/**
 * Consensus is the point of the grouped view: an entry several jurors shortlisted is a stronger
 * result than one that only leads a single juror's list. Winners rank above pure shortlist overlap
 * because picking a winner is the more deliberate act.
 */
function buildConsensus(jurors: JuryDomainResult[]): JuryConsensusEntry[] {
  const byParticipantId = new Map<number, JuryConsensusEntry>()

  for (const juror of jurors) {
    for (const pick of juror.shortlist) {
      const existing = byParticipantId.get(pick.participantId)
      if (existing) {
        existing.shortlistedBy += 1
        existing.wonBy += pick.isWinner ? 1 : 0
      } else {
        byParticipantId.set(pick.participantId, {
          participant: pick.participant,
          shortlistedBy: 1,
          wonBy: pick.isWinner ? 1 : 0,
        })
      }
    }
  }

  return Array.from(byParticipantId.values()).toSorted((left, right) => {
    if (right.wonBy !== left.wonBy) return right.wonBy - left.wonBy
    if (right.shortlistedBy !== left.shortlistedBy) return right.shortlistedBy - left.shortlistedBy
    return compareParticipantReferences(left.participant, right.participant)
  })
}

export function groupJuryResultsByScope(results: JuryDomainResult[]): JuryScopeGroup[] {
  const groups = new Map<string, JuryScopeGroup>()

  for (const result of results) {
    const key = getJuryScopeKey(result)
    const existing = groups.get(key)
    if (existing) {
      existing.jurors.push(result)
    } else {
      groups.set(key, {
        key,
        label: getJuryScopeLabel(result),
        jurors: [result],
        consensus: [],
      })
    }
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      jurors: group.jurors.toSorted((left, right) =>
        left.displayName.localeCompare(right.displayName),
      ),
      consensus: buildConsensus(group.jurors),
    }))
    .toSorted(compareScopes)
}
