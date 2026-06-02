import { assert, describe, it } from '@effect/vitest'
import { Schema } from 'effect'
import {
  RealtimeEventResultPayloadSchema,
  VotingVoteCastPayloadSchema,
  getDomainRealtimeChannel,
  getParticipantRealtimeChannel,
  getRealtimeResultEventName,
  getVotingVoteCastEventName,
} from './contract'

describe('realtime contract', () => {
  describe('getRealtimeResultEventName', () => {
    it('should build generic result event names', () => {
      assert.strictEqual(
        getRealtimeResultEventName('submission-processed'),
        'event.result.submission-processed',
      )
      assert.strictEqual(
        getRealtimeResultEventName('participant-validated'),
        'event.result.participant-validated',
      )
    })
  })

  describe('getVotingVoteCastEventName', () => {
    it('should build the voting vote-cast event name', () => {
      assert.strictEqual(getVotingVoteCastEventName(), 'event.voting.vote-cast')
    })
  })

  describe('channel helpers', () => {
    it('should generate domain and participant channel strings', () => {
      assert.strictEqual(getDomainRealtimeChannel('dev', 'demo'), 'dev:demo')
      assert.strictEqual(getParticipantRealtimeChannel('prod', 'demo', '1234'), 'prod:demo:1234')
    })
  })

  describe('RealtimeEventResultPayloadSchema', () => {
    it('should accept success payloads', () => {
      assert.ok(
        Schema.is(RealtimeEventResultPayloadSchema)({
          eventKey: 'participant-validated',
          outcome: 'success',
          domain: 'demo',
          reference: '1234',
          orderIndex: null,
          timestamp: 100,
          duration: 10,
        }),
      )
    })

    it('should accept error payloads with an error field', () => {
      assert.ok(
        Schema.is(RealtimeEventResultPayloadSchema)({
          eventKey: 'participant-finalized',
          outcome: 'error',
          domain: 'demo',
          reference: '1234',
          orderIndex: null,
          timestamp: 100,
          duration: 10,
          error: 'boom',
        }),
      )
    })

    it('should reject error payloads missing the error field', () => {
      assert.strictEqual(
        Schema.is(RealtimeEventResultPayloadSchema)({
          eventKey: 'participant-finalized',
          outcome: 'error',
          domain: 'demo',
          reference: '1234',
          orderIndex: null,
          timestamp: 100,
          duration: 10,
        }),
        false,
      )
    })
  })

  describe('VotingVoteCastPayloadSchema', () => {
    it('should accept valid voting vote-cast payloads', () => {
      assert.ok(
        Schema.is(VotingVoteCastPayloadSchema)({
          eventId: '42:2026-03-17T12:00:00.000Z',
          domain: 'demo',
          topicId: 7,
          sessionId: 42,
          submissionId: 99,
          votedAt: '2026-03-17T12:00:00.000Z',
          participantReference: '1234',
          participantFirstName: 'Ada',
          participantLastName: 'Lovelace',
          submissionCreatedAt: '2026-03-17T11:00:00.000Z',
          submissionKey: 'submission-key',
          submissionThumbnailKey: 'thumb-key',
        }),
      )
    })
  })
})
