# S3 upload concurrency limit options
_Exported on 12/24/2025 at 11:37:27 GMT+1 from Cursor (2.2.36)_

---

**User**

Analyze the flow starting in @apps/web-v2/src/app/(marathon)/live/[domain]/client-page.tsx and the different tasks in @tasks/ up to @tasks/upload-finalizer/ .

What are some options to implement a sort of 'concurrency limit' or 'rate-limit' that makes the client wait before starting uploading to s3 until there are a spot available. I want to set the max concurrent upload sessions or something.

For example, at a photo event there might be 3000 people uploading at the same time. I want to set max concurrent sessions at like 300, even though the upload process itself is fairly quick, its just to reduce concurrent load on redis, db and so on.

At the same time, it needs to be robust so we dont have a lot of hangin locks if a upload fail and not releasing its spot

---

**Cursor**

Plan: I’ll trace the end-to-end upload flow from the `client-page.tsx` mutation through the TRPC router and the upload-session/kv store pieces, then inspect the `tasks/` workers (especially `upload-finalizer`) to see where state is mutated. After that, I’ll lay out a few concrete concurrency-limit designs (token bucket / semaphore / queue) with failure-safe lease/TTL semantics that fit your Redis/KV setup.

Nice: the current flow already has a natural “session boundary” at `initializeUploadFlow` (DB writes + Redis session init + presigned URL generation), and `UploadFinalizerService` even has a TODO to “release the upload session total lock” — so adding a concurrency gate here fits well and doesn’t require touching the S3 PUT path directly. Next I’ll inspect the other upload-related tasks (`upload-processor`, `validation-runner`) and any pubsub/SSE hooks to see where a slot should be acquired/released and how to handle failures.

Aha: the “upload session” lifecycle is already well-defined: `initializeUploadFlow` creates participant/submissions + initializes Redis state, then S3 PUT triggers `upload-processor` which increments participant progress, and when all photos are processed it emits a `Finalized` bus event that drives `upload-finalizer` (and there’s an explicit TODO to release a “total lock” there). That’s exactly the seam to implement a global concurrency gate with a lease/TTL so failures don’t leave hanging locks.

### Current flow (client → backend → tasks)

- **Client starts the flow** by calling `uploadFlow.initializeUploadFlow`, then immediately starts **PUT uploads to S3 in parallel**:

```167:219:apps/web-v2/src/app/(marathon)/live/[domain]/client-page.tsx
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // ...
    const result = await mut.mutateAsync({
      domain,
      reference: participantData.reference,
      firstname: participantData.firstname,
      lastname: participantData.lastname,
      email: participantData.email,
      competitionClassId,
      deviceGroupId,
    })

    setIsUploading(true)

    const filesToUpload = selectedFiles.slice(0, result.length)
    const uploadPromises = filesToUpload.map((file, index) => {
      const presignedData = result[index]
      if (!presignedData) throw new Error(`No presigned URL found for file ${index + 1}`)
      return uploadFileToPresignedUrl(file, presignedData.url, String(presignedData.key))
    })

    await Promise.all(uploadPromises)
  }
```

- **`initializeUploadFlow` is the “session start” choke-point today**. It hits DB (participant + submissions), initializes Redis session state, then generates and returns presigned URLs:

```36:162:packages/api-v2/src/trpc/routers/upload-flow.ts
  initializeUploadFlow: publicProcedure
    .input(/* ... */)
    .mutation(
      trpcEffect(
        Effect.fn("UploadFlowRouter.getUploadFlow")(function* ({ input }) {
          const db = yield* Database
          const kv = yield* UploadSessionRepository

          // participant + submissions in DB
          const participant = yield* /* create/update participant */
          yield* db.submissionsQueries.createMultipleSubmissions({ /* ... */ })

          // per-participant redis state
          yield* kv.initializeState(input.domain, input.reference, submissionKeys)

          // presigned URLs returned to client
          const presignedUrls = yield* Effect.forEach(
            submissionKeys,
            (key) => s3.getPresignedUrl(bucketName, key, "PUT"),
            { concurrency: "unbounded" }
          )
          return Array.zip(submissionKeys, presignedUrls).map(([key, url]) => ({ key, url }))
        })
      )
    ),
```

- **After S3 PUT**, your `tasks/upload-processor` reacts to S3→SQS events, updates Redis submission + participant state, and when all expected submissions are processed it emits a **Finalized** EventBridge event:

```96:120:tasks/upload-processor/src/processor-service.ts
        yield* uploadKv.updateSubmissionSession(domain, reference, orderIndex, { uploaded: true, /* ... */ })

        const { finalize } = yield* uploadKv.incrementParticipantState(domain, reference, orderIndex)

        if (finalize) {
          yield* bus.sendFinalizedEvent(domain, reference)
        }
```

- **Finalized fan-out**: multiple tasks run off that same Finalized event (validation, contact-sheet, zip-worker, upload-finalizer). `upload-finalizer` updates DB statuses and has an explicit TODO to release a global lock:

```21:81:tasks/upload-finalizer/src/service.ts
      const finalizeParticipant = Effect.fn("UploadFinalizerService.finalizeParticipant")(
        function* (domain: string, reference: string) {
          // read states from redis/exif, update DB, mark participant completed
          yield* Effect.all([ /* update submissions */, /* update participant */ ], { concurrency: 2 })
        }

        //TODO: release the upload session total lock here
      )
```

---

### Where to implement “max concurrent upload sessions”

If the goal is “**make the client wait before starting S3 uploads**”, the best place to gate is **before returning presigned URLs** (i.e. at/around `initializeUploadFlow`). That’s the last point where you can reliably prevent S3 traffic and also avoid creating DB/Redis session state for “queued” users.

---

### Options (from simplest to most robust)

#### Option A — **Redis semaphore (active-set) with TTL lease** (recommended)
Implement a global “active upload sessions” semaphore in Redis:

- **Acquire** a slot when the user clicks submit (right before presigned URLs are handed out).
- If full: return `retryAfterMs` (and optionally `activeCount/limit`) and the client waits (backoff + jitter) and retries.
- If granted: proceed with the existing `initializeUploadFlow` and start uploading.
- **Release** the slot in `upload-finalizer` (and also in error paths), but the critical safety net is the **lease TTL** so abandoned sessions free themselves.

Robustness against hanging locks:
- Use a **lease** (sessionId + expiry). If the client disappears or a worker never reaches release, the lease expires and the slot is reclaimed.
- Add a **heartbeat/renew** endpoint during active uploading if uploads can exceed the lease TTL (only up to max-active sessions will be heartbeating, e.g. 300).

A solid Redis shape for this:
- `ZSET upload:sessions:active` where:
  - member = `domain:reference` (or `domain:reference:leaseId`)
  - score = `expiresAtEpochMs`
- Atomic acquire via Lua:
  - `ZREMRANGEBYSCORE active -inf now` (cleanup expired)
  - if `ZCARD active >= limit` → deny + suggest retryAfter (based on min score)
  - else `ZADD active expiresAt member` → ok
- Release via Lua:
  - `ZREM active member` (idempotent)

To prevent one participant consuming multiple slots on retries/refresh:
- Store a per-participant lease key too (e.g. `SET upload:lease:{domain}:{ref} <leaseId> PX <ttl> NX`), and only count them once.

#### Option B — **Queue + semaphore** (fairness / “position in line”)
If you care about fairness (first-come-first-served) and avoiding thundering-herd retries:

- `ZSET upload:sessions:waiting` score=`enqueueTime`
- `ZSET upload:sessions:active` score=`expiresAt`
- Client calls `enqueueOrAcquire`:
  - if slot available, move self to active and return presigned URLs
  - else ensure self is in waiting and return `position` (ZRANK) + `retryAfterMs`
- Client polls at a modest interval (or you add SSE “slot granted” events if you introduce a dispatcher).

This is more moving parts but can give a better UX under heavy contention.

#### Option C — **Backend-only throttling (Lambda reserved concurrency / SQS)** (protects Redis/DB but doesn’t “make client wait”)
You can cap load without client waiting by:
- Setting **reserved concurrency** on `upload-processor`, `upload-finalizer`, `validation-runner`, etc.
- Tuning **SQS batch sizes/concurrency**.

Result: 3000 clients can upload to S3 immediately, but processing/DB/Redis work drains at a controlled rate. This avoids building locks/leases entirely, but doesn’t satisfy “wait before uploading”.

#### Option D — **Rate-limit `initializeUploadFlow` at the edge** (simple, coarse)
API Gateway / Cloudflare rate limits can slow initializations. It helps, but it’s not a true “max concurrent sessions” and won’t gracefully handle “active session” semantics.

---

### Practical recommendation for your repo

- **Implement Option A**:
  - Acquire slot **inside** `initializeUploadFlow` *before* DB/Redis writes and before generating presigned URLs.
  - Return a structured “queued” response (or a typed TRPC error with `retryAfterMs`).
  - Release in `upload-finalizer` (that TODO is the perfect hook) and ensure release runs in a `finally`-style path.
  - Add TTL/lease so no hanging locks even if the pipeline breaks before finalizer runs.

- Also consider **per-client upload concurrency** (separate but complementary): your older web hook already chunks uploads (`UPLOAD_CONCURRENCY_LIMIT`) so you don’t `Promise.all` everything at once. That won’t solve global session concurrency, but it reduces spikes per user.

If you want, I can sketch the exact TRPC response shape and the Redis Lua scripts (acquire/renew/release) tailored to your existing `@blikka/redis` + `Effect` patterns.

```typescriptreact
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // ...
    const result = await mut.mutateAsync({
      domain,
      reference: participantData.reference,
      firstname: participantData.firstname,
      lastname: participantData.lastname,
      email: participantData.email,
      competitionClassId,
      deviceGroupId,
    })

    setIsUploading(true)

    const filesToUpload = selectedFiles.slice(0, result.length)
    const uploadPromises = filesToUpload.map((file, index) => {
      const presignedData = result[index]
      if (!presignedData) throw new Error(`No presigned URL found for file ${index + 1}`)
      return uploadFileToPresignedUrl(file, presignedData.url, String(presignedData.key))
    })

    await Promise.all(uploadPromises)
  }
```

```typescript
  initializeUploadFlow: publicProcedure
    .input(/* ... */)
    .mutation(
      trpcEffect(
        Effect.fn("UploadFlowRouter.getUploadFlow")(function* ({ input }) {
          const db = yield* Database
          const kv = yield* UploadSessionRepository

          // participant + submissions in DB
          const participant = yield* /* create/update participant */
          yield* db.submissionsQueries.createMultipleSubmissions({ /* ... */ })

          // per-participant redis state
          yield* kv.initializeState(input.domain, input.reference, submissionKeys)

          // presigned URLs returned to client
          const presignedUrls = yield* Effect.forEach(
            submissionKeys,
            (key) => s3.getPresignedUrl(bucketName, key, "PUT"),
            { concurrency: "unbounded" }
          )
          return Array.zip(submissionKeys, presignedUrls).map(([key, url]) => ({ key, url }))
        })
      )
    ),
```

```typescript
        yield* uploadKv.updateSubmissionSession(domain, reference, orderIndex, { uploaded: true, /* ... */ })

        const { finalize } = yield* uploadKv.incrementParticipantState(domain, reference, orderIndex)

        if (finalize) {
          yield* bus.sendFinalizedEvent(domain, reference)
        }
```

```typescript
      const finalizeParticipant = Effect.fn("UploadFinalizerService.finalizeParticipant")(
        function* (domain: string, reference: string) {
          // read states from redis/exif, update DB, mark participant completed
          yield* Effect.all([ /* update submissions */, /* update participant */ ], { concurrency: 2 })
        }

        //TODO: release the upload session total lock here
      )
```

---

**User**

I care about fairness and position in line. So a queue seems reasonable. Dig deeper in option b and explain to me more thrurrow how it would work

---

**Cursor**

### Option B (Fair queue + active slots): how it works end-to-end

The key requirement for **fairness** is: *no matter who is polling, the system always grants the next slot to the oldest waiting entry*. That means the server must always “promote from the head of the queue”, not “promote the caller”.

You implement this with two Redis sorted sets + leases:

- **`ZSET upload:sessions:waiting`**  
  - **member**: `domain:reference` (or `domain:reference:clientId`)  
  - **score**: `enqueuedAtMs` (server time)
- **`ZSET upload:sessions:active`**  
  - **member**: `domain:reference` (or `...:leaseId`)  
  - **score**: `activeLeaseExpiresAtMs`
- Optional helper keys:
  - **`STRING upload:sessions:lease:{domain}:{reference}`** = `leaseId` (with TTL), to avoid duplicates / multi-tab collisions.

---

### The protocol (client ↔ server)

You usually split your current `initializeUploadFlow` into “slot acquisition” + “init + presigned URLs”, or keep one endpoint but make it return “WAIT” vs “GRANTED”.

#### 1) Client requests a slot (enqueue if needed)
Client calls e.g. `uploadFlow.requestSlot({ domain, reference })`.

Server does (atomically, Lua):

- **Cleanup expired actives**: remove active entries whose `expiresAt <= now`.
- If this participant is already **active** → return `GRANTED` (idempotent).
- Ensure this participant is **in waiting**:
  - `ZADD waiting NX now member` (NX ensures you don’t insert duplicates on refresh/retry).
- Compute:
  - **position** = `ZRANK waiting member` (0-based)
  - **activeCount** = `ZCARD active`
  - **limit** = configured max (e.g. 300)
- If `activeCount < limit` *and* **the head of waiting is this member**:
  - Promote it (see next step), return `GRANTED`.
- Else return `WAIT` with `{ position, pollAfterMs }`.

Why “head must be this member” matters:
- It enforces fairness even if someone else is polling aggressively.

#### 2) Promotion: server moves head-of-line → active
Promotion should always be “pop head-of-waiting”, not “promote requester”.

Atomically (Lua):

- Let `next = ZRANGE waiting 0 0`
- If no `next`, stop.
- If `ZCARD active >= limit`, stop.
- Remove `next` from waiting: `ZREM waiting next`
- Add to active with lease expiry: `ZADD active now + leaseTtlMs next`
- Set `lease:{next}` = `leaseId` with TTL (optional but helpful)
- Return `next` (and maybe its `leaseId`)

In practice you combine “promotion loop” into the poll endpoint:
- On every poll, the server tries to promote **as many as possible** until the active limit is full. That keeps the queue moving without needing a separate worker.

#### 3) When caller becomes active: return presigned URLs (and start uploading)
When the server responds `GRANTED`, it can now safely do what `initializeUploadFlow` currently does:

- Create/update participant + submissions in DB
- `kv.initializeState(...)`
- Generate presigned URLs
- Return `{ presignedUrls, leaseId, leaseExpiresAt }`

Client then starts S3 PUT.

#### 4) Keep-alive (to prevent “granted but user vanished” from holding a slot)
You need this for robustness + throughput.

Typical pattern:
- When a slot is granted, set a **short “grace lease”** (e.g. 60–90s).
- Client must call `uploadFlow.heartbeat({ leaseId })` every ~20–30s *while uploading*.
- On heartbeat, server extends the active lease expiry (updates `ZADD active XX` and refreshes `lease:{member}` TTL).

If the client never starts uploading (closes tab, loses network), it stops heartbeating and the slot auto-frees quickly.

#### 5) Release the slot
Two releases (belt + suspenders):

- **Primary**: release when the system knows the session is “done enough”.
  - You already have a strong hook: `upload-finalizer` has `//TODO: release the upload session total lock here`.
  - Implement `releaseSlot(domain, reference, leaseId)` there (idempotent).
- **Safety net**: TTL expiry in `active` if finalizer never runs / errors / missing events.

Important design choice:
- If your goal is “limit concurrent *upload sessions*”, you probably want to release when uploads are “complete enough” (e.g. when `incrementParticipantState` returns `FINALIZED` / bus event is sent), not after all post-processing tasks finish.  
  If you also need to protect post-processing load, use a **second queue** for “finalization slots”.

---

### What the client UI does (position + polling)

When server returns `WAIT`:
- Show “You’re in line: **position + 1**”
- Poll with jitter: `pollAfterMs + random(0..250ms)` to reduce stampedes.
- If you want extra fairness/UX, return **`position`** and **`activeCount/limit`**.

When it becomes `GRANTED`:
- Proceed exactly like you do today (upload to presigned URLs).

You can keep your existing SSE (pubsub “run state”) for after uploading; the queue itself is simpler as poll-based.

---

### Handling the tricky edge cases (where queues usually break)

- **Multi-tab / retries**: use `ZADD waiting NX` + a per-participant `lease:{domain}:{ref}` to ensure one logical spot per participant.
- **User refresh while waiting**: they stay in the same waiting entry → rank is stable.
- **User disappears while waiting**: optional cleanup:
  - either accept it (harmless; they’ll eventually get promoted then quickly expire due to no heartbeat),
  - or store `waiting:{member}` with TTL and periodically `ZREM` stale waiters (more complexity).
- **User gets granted but never uploads**: short grace lease + heartbeat requirement solves this.
- **Out-of-order promotion**: prevented because promotion always takes `ZRANGE 0 0`.
- **Thundering herd**: return `pollAfterMs` based on:
  - a floor (e.g. 500–1500ms),
  - and/or earliest active expiry (`ZMIN active`) so callers back off when no slots will open soon.

---

### How this fits your current code shape

- **Choke-point**: `packages/api-v2/src/trpc/routers/upload-flow.ts` is where you decide “WAIT vs GRANTED” *before* doing DB/Redis work and before returning presigned URLs.
- **Release hook**: `tasks/upload-finalizer/src/service.ts` already calls out the exact missing piece.

If you want, I can propose a concrete TRPC API shape (`requestSlot`, `heartbeat`, `cancelSlot`, `releaseSlot`) and the Lua script contracts (inputs/outputs) so you can drop it into `@blikka/kv-store` cleanly.

---

**User**

yes propose the trpc and lua shapes

---

**Cursor**

### TRPC shapes (API surface)

You can do this as **one union-returning mutation** (simplest client), plus heartbeat/cancel:

#### 1) `uploadFlow.initializeUploadFlow` (now does “queue + maybe init”)
- **Input (existing + optional)**:
  - `domain, reference, firstname, lastname, email, competitionClassId, deviceGroupId`
  - `clientId?: string` (optional, stable per device/tab; helps dedupe multi-tab)
- **Output (union)**:

```ts
interface UploadQueueWaitResponse {
  status: "WAIT"
  position: number // 0-based
  activeCount: number
  limit: number
  pollAfterMs: number
}

interface UploadQueueGrantedResponse {
  status: "GRANTED"
  leaseId: string
  leaseExpiresAtMs: number
  presigned: Array<{ key: string; url: string }>
}

type InitializeUploadFlowResponse = UploadQueueWaitResponse | UploadQueueGrantedResponse
```

- **Behavior**:
  - Calls Redis Lua `queue_status_or_acquire` using `(domain, reference[, clientId])`.
  - If `WAIT`: return position/pollAfter.
  - If `GRANTED`: proceed with current DB writes + `kv.initializeState` + presigned URLs and return them along with `leaseId`.

This ensures the client **does not get presigned URLs** until it owns an active slot.

#### 2) `uploadFlow.heartbeatUploadSlot`
- **Input**: `{ domain, reference, leaseId }`
- **Output**: `{ ok: true; leaseExpiresAtMs: number } | { ok: false; reason: "NOT_ACTIVE" | "LEASE_MISMATCH" }`
- Client calls every ~20–30s while uploading.

#### 3) `uploadFlow.cancelUploadSlot`
- **Input**: `{ domain, reference }` (and optionally `clientId`)
- **Output**: `{ ok: true }`
- Removes from waiting if user aborts before being granted.

#### 4) (Optional) `uploadFlow.releaseUploadSlot`
- You likely won’t call this from the client; instead call it from `tasks/upload-finalizer` (or at “FINALIZED” time).
- **Input**: `{ domain, reference, leaseId }`
- **Output**: `{ ok: true }`

---

### Redis key / member shapes

Use stable member identity per participant:

- **member**: `${domain}:${reference}` (or include `clientId` if you truly want multiple sessions per participant; usually you don’t)

Keys:

- `upload:q:waiting` (ZSET) — score=`enqueuedAtMs`, member=`member`
- `upload:q:active` (ZSET) — score=`leaseExpiresAtMs`, member=`member`
- `upload:q:lease:${member}` (STRING) — value=`leaseId`, TTL = `leaseTtlMs`

Why this combo:
- ZSETs give **rank/position** and **fair head-of-line**.
- The lease string provides a **single source of truth** for “who owns the slot” and gives you TTL for free.

---

### Lua script shapes (contracts)

All scripts should use Redis server time to avoid clock skew:
- `local t = redis.call("TIME"); local nowMs = t[1]*1000 + math.floor(t[2]/1000)`

#### Script A: `queue_status_or_acquire.lua` (fairness + promotion)
**Purpose**: enqueue caller (NX), cleanup expired actives, promote head-of-line while capacity, return caller status + position.

- **KEYS**:
  1) `waitingKey` = `upload:q:waiting`
  2) `activeKey` = `upload:q:active`
  3) `leaseKey` = `upload:q:lease:${member}` (pass full key in)
- **ARGV**:
  1) `member` (e.g. `domain:ref`)
  2) `limit` (e.g. `300`)
  3) `leaseTtlMs` (e.g. `90000`)
  4) `pollMinMs` (e.g. `750`) optional

- **Returns** (array of strings/numbers; easy to decode with Effect Schema):
  - If GRANTED: `{"GRANTED", leaseId, leaseExpiresAtMs, activeCount, limit}`
  - If WAIT: `{"WAIT", position, activeCount, limit, pollAfterMs}`

**Core logic (pseudocode)**:
```lua
-- nowMs from TIME
-- 1) cleanup expired actives: ZREMRANGEBYSCORE(active, -inf, nowMs)
-- 2) ensure in waiting: ZADD(waiting, NX, nowMs, member)
-- 3) if already active (ZSCORE(active, member) ~= false) then
--      leaseId = GET(leaseKey) ; if nil -> recreate leaseId+TTL (optional)
--      return GRANTED
--    end
-- 4) promotion loop while ZCARD(active) < limit:
--      next = ZRANGE(waiting, 0, 0)[1]; if not next break end
--      ZREM(waiting, next)
--      expiresAt = nowMs + leaseTtlMs
--      ZADD(active, expiresAt, next)
--      -- create/refresh lease for next
--      leaseKeyNext = "upload:q:lease:" .. next  (or pass a pattern; simplest is compute here)
--      leaseId = <generated>  (see note below)
--      SET(leaseKeyNext, leaseId, PX, leaseTtlMs)
--    end
-- 5) if caller is active now => GRANTED
-- 6) else => WAIT, position = ZRANK(waiting, member)
--    pollAfterMs = pollMinMs or (minActiveExpiry - nowMs) bounded
```

**LeaseId generation note**:
- Lua can’t reliably generate UUIDs without extra libs. Two practical approaches:
  - **Approach 1 (recommended)**: leaseId = `${nowMs}:${random}` where `random` comes from `math.random()` seeded once per script load (good enough for ownership checks).
  - **Approach 2**: don’t store leaseId at all; rely only on TTL (simpler, but less safe for stale releases). I’d keep leaseId.

If you want strong IDs, generate `leaseId` in TS and pass it in, but then the script must only set it when granting the head-of-line (meaning the caller can’t precompute for someone else). So in practice: let Lua create it.

To compute `leaseKeyNext` inside Lua, standardize the prefix (`upload:q:lease:`) and concatenate with the member.

#### Script B: `queue_heartbeat.lua`
**Purpose**: extend lease iff caller still owns it.

- **KEYS**:
  1) `activeKey`
  2) `leaseKey` (for member)
- **ARGV**:
  1) `member`
  2) `leaseId`
  3) `leaseTtlMs`

- **Returns**:
  - `{"OK", leaseExpiresAtMs}`
  - `{"NOT_ACTIVE"}`
  - `{"LEASE_MISMATCH"}`

**Logic**:
- if `ZSCORE(activeKey, member)` missing → `NOT_ACTIVE`
- if `GET(leaseKey) != leaseId` → `LEASE_MISMATCH`
- set new expiry = `nowMs + leaseTtlMs`
- `ZADD activeKey XX newExpiry member`
- `PEXPIRE leaseKey leaseTtlMs`
- return OK

#### Script C: `queue_release.lua`
**Purpose**: release slot (idempotent), only if lease matches (optional strictness).

- **KEYS**:
  1) `activeKey`
  2) `leaseKey`
- **ARGV**:
  1) `member`
  2) `leaseId` (optional; pass empty to force release, but I’d keep it strict)

- **Returns**:
  - `{"RELEASED"}`
  - `{"NOT_ACTIVE"}`
  - `{"LEASE_MISMATCH"}`

**Logic**:
- if active missing → NOT_ACTIVE (still OK to treat as released)
- if lease mismatch → LEASE_MISMATCH
- `ZREM active member`
- `DEL leaseKey`
- return RELEASED

#### Script D: `queue_cancel.lua`
**Purpose**: remove from waiting (if user cancels before grant).

- **KEYS**:
  1) `waitingKey`
- **ARGV**:
  1) `member`
- **Returns**: `{"CANCELLED", removedCount}`

---

### Where you’d call release in your codebase

- Add release in `tasks/upload-finalizer/src/service.ts` exactly at the TODO:
  - best-effort, idempotent, ignore NOT_ACTIVE.
- If you want “slot = uploading only”, you can also release earlier (when `FINALIZED` is emitted in `upload-processor`), but then you need to decide whether you still want to limit the post-processing fan-out separately.

---

If you switch to Agent mode, I can map these scripts into a new `@blikka/kv-store` service (similar to `UploadSessionRepository`) and update the TRPC router to return the `WAIT | GRANTED` union cleanly with `Effect` Schema decoding.

```typescript
interface UploadQueueWaitResponse {
  status: "WAIT"
  position: number // 0-based
  activeCount: number
  limit: number
  pollAfterMs: number
}

interface UploadQueueGrantedResponse {
  status: "GRANTED"
  leaseId: string
  leaseExpiresAtMs: number
  presigned: Array<{ key: string; url: string }>
}

type InitializeUploadFlowResponse = UploadQueueWaitResponse | UploadQueueGrantedResponse
```

```lua
-- nowMs from TIME
-- 1) cleanup expired actives: ZREMRANGEBYSCORE(active, -inf, nowMs)
-- 2) ensure in waiting: ZADD(waiting, NX, nowMs, member)
-- 3) if already active (ZSCORE(active, member) ~= false) then
--      leaseId = GET(leaseKey) ; if nil -> recreate leaseId+TTL (optional)
--      return GRANTED
--    end
-- 4) promotion loop while ZCARD(active) < limit:
--      next = ZRANGE(waiting, 0, 0)[1]; if not next break end
--      ZREM(waiting, next)
--      expiresAt = nowMs + leaseTtlMs
--      ZADD(active, expiresAt, next)
--      -- create/refresh lease for next
--      leaseKeyNext = "upload:q:lease:" .. next  (or pass a pattern; simplest is compute here)
--      leaseId = <generated>  (see note below)
--      SET(leaseKeyNext, leaseId, PX, leaseTtlMs)
--    end
-- 5) if caller is active now => GRANTED
-- 6) else => WAIT, position = ZRANK(waiting, member)
--    pollAfterMs = pollMinMs or (minActiveExpiry - nowMs) bounded
```

---

**User**

Implement the scripts in a new kv store in @blikka/kv-store 

---

**Cursor**

Got it. I’ll add a new repository in `@blikka/kv-store` that encapsulates the **fair queue + active lease** logic, backed by Redis ZSETs + small Lua scripts (enqueue/promote/status, heartbeat, release, cancel). Then I’ll export it from the package so `api-v2`/tasks can consume it next.

```typescript
export const luaQueueStatusOrAcquire = `
-- KEYS[1] = waitingKey (ZSET)
-- KEYS[2] = activeKey  (ZSET)
--
-- ARGV[1] = member (e.g. "domain:reference")
-- ARGV[2] = limit (number)
-- ARGV[3] = leaseTtlMs (number)
-- ARGV[4] = leaseKeyPrefix (e.g. "upload-q:lease:")
-- ARGV[5] = pollMinMs (number)
--
-- Returns:
--   { "GRANTED", leaseId, leaseExpiresAtMs, activeCount, limit }
--   { "WAIT", position, activeCount, limit, pollAfterMs }

local t = redis.call("TIME")
local nowMs = (t[1] * 1000) + math.floor(t[2] / 1000)

local waitingKey = KEYS[1]
local activeKey = KEYS[2]

local member = ARGV[1]
local limit = tonumber(ARGV[2])
local leaseTtlMs = tonumber(ARGV[3])
local leaseKeyPrefix = ARGV[4]
local pollMinMs = tonumber(ARGV[5])

if not member or member == "" then
  return { "WAIT", -1, -1, limit or -1, pollMinMs or 1000 }
end

-- Remove expired actives (leases expire)
redis.call("ZREMRANGEBYSCORE", activeKey, "-inf", nowMs)

-- Enqueue once (stable position)
redis.call("ZADD", waitingKey, "NX", nowMs, member)

-- If already active, ensure lease key exists and return GRANTED
local activeScore = redis.call("ZSCORE", activeKey, member)
if activeScore then
  local leaseKey = leaseKeyPrefix .. member
  local existingLeaseId = redis.call("GET", leaseKey)
  if not existingLeaseId then
    math.randomseed(nowMs)
    local newLeaseId = redis.sha1hex(member .. ":" .. tostring(nowMs) .. ":" .. tostring(math.random(1000000)))
    local newExpiresAt = nowMs + leaseTtlMs
    redis.call("SET", leaseKey, newLeaseId, "PX", leaseTtlMs)
    redis.call("ZADD", activeKey, "XX", newExpiresAt, member)
    return { "GRANTED", newLeaseId, newExpiresAt, redis.call("ZCARD", activeKey), limit }
  end
  return { "GRANTED", existingLeaseId, tonumber(activeScore), redis.call("ZCARD", activeKey), limit }
end

-- Promote head-of-line while there is capacity
local activeCount = tonumber(redis.call("ZCARD", activeKey))
while activeCount < limit do
  local head = redis.call("ZRANGE", waitingKey, 0, 0)
  if not head or not head[1] then
    break
  end

  local nextMember = head[1]
  redis.call("ZREM", waitingKey, nextMember)

  local expiresAt = nowMs + leaseTtlMs
  redis.call("ZADD", activeKey, expiresAt, nextMember)

  math.randomseed(nowMs)
  local leaseId = redis.sha1hex(nextMember .. ":" .. tostring(nowMs) .. ":" .. tostring(math.random(1000000)))
  redis.call("SET", leaseKeyPrefix .. nextMember, leaseId, "PX", leaseTtlMs)

  activeCount = activeCount + 1
end

-- Caller may have become active via promotion
local newActiveScore = redis.call("ZSCORE", activeKey, member)
if newActiveScore then
  local leaseId = redis.call("GET", leaseKeyPrefix .. member)
  if not leaseId then
    math.randomseed(nowMs)
    leaseId = redis.sha1hex(member .. ":" .. tostring(nowMs) .. ":" .. tostring(math.random(1000000)))
    redis.call("SET", leaseKeyPrefix .. member, leaseId, "PX", leaseTtlMs)
    redis.call("ZADD", activeKey, "XX", nowMs + leaseTtlMs, member)
    newActiveScore = nowMs + leaseTtlMs
  end
  return { "GRANTED", leaseId, tonumber(newActiveScore), redis.call("ZCARD", activeKey), limit }
end

-- Otherwise, return WAIT with position and a reasonable poll delay.
local position = redis.call("ZRANK", waitingKey, member)
if not position then
  position = -1
end

local pollAfterMs = pollMinMs or 1000
local minActive = redis.call("ZRANGE", activeKey, 0, 0, "WITHSCORES")
if minActive and minActive[2] then
  local earliestExpiry = tonumber(minActive[2])
  if earliestExpiry and earliestExpiry > nowMs then
    local untilFree = earliestExpiry - nowMs
    -- Clamp to avoid clients sleeping too long and to keep responsiveness.
    if untilFree < pollAfterMs then
      pollAfterMs = untilFree
    end
    if pollAfterMs < 250 then
      pollAfterMs = 250
    end
  end
end

return { "WAIT", tonumber(position), redis.call("ZCARD", activeKey), limit, tonumber(pollAfterMs) }
`


```

Nice—this gives us the core fairness mechanism: a single Lua call that (1) cleans expired actives, (2) ensures the caller is queued once, (3) promotes strictly from the head while capacity, and (4) returns either **WAIT with rank** or **GRANTED with a lease**. Next I’ll add the heartbeat/release/cancel Lua scripts and wrap them in a new `UploadQueueRepository` service in `@blikka/kv-store`, including Effect Schemas for safe decoding.

```typescript
export const luaQueueHeartbeat = `
-- KEYS[1] = activeKey (ZSET)
--
-- ARGV[1] = member
-- ARGV[2] = leaseId
-- ARGV[3] = leaseTtlMs
-- ARGV[4] = leaseKeyPrefix
--
-- Returns:
--   { "OK", leaseExpiresAtMs }
--   { "NOT_ACTIVE" }
--   { "LEASE_MISMATCH" }

local t = redis.call("TIME")
local nowMs = (t[1] * 1000) + math.floor(t[2] / 1000)

local activeKey = KEYS[1]

local member = ARGV[1]
local leaseId = ARGV[2]
local leaseTtlMs = tonumber(ARGV[3])
local leaseKeyPrefix = ARGV[4]

local score = redis.call("ZSCORE", activeKey, member)
if not score then
  return { "NOT_ACTIVE" }
end

local leaseKey = leaseKeyPrefix .. member
local currentLeaseId = redis.call("GET", leaseKey)
if not currentLeaseId or currentLeaseId ~= leaseId then
  return { "LEASE_MISMATCH" }
end

local expiresAt = nowMs + leaseTtlMs
redis.call("ZADD", activeKey, "XX", expiresAt, member)
redis.call("PEXPIRE", leaseKey, leaseTtlMs)

return { "OK", expiresAt }
`


```

```typescript
export const luaQueueRelease = `
-- KEYS[1] = activeKey (ZSET)
--
-- ARGV[1] = member
-- ARGV[2] = leaseId
-- ARGV[3] = leaseKeyPrefix
--
-- Returns:
--   { "RELEASED" }
--   { "NOT_ACTIVE" }
--   { "LEASE_MISMATCH" }

local activeKey = KEYS[1]

local member = ARGV[1]
local leaseId = ARGV[2]
local leaseKeyPrefix = ARGV[3]

local score = redis.call("ZSCORE", activeKey, member)
if not score then
  return { "NOT_ACTIVE" }
end

local leaseKey = leaseKeyPrefix .. member
local currentLeaseId = redis.call("GET", leaseKey)
if not currentLeaseId or currentLeaseId ~= leaseId then
  return { "LEASE_MISMATCH" }
end

redis.call("ZREM", activeKey, member)
redis.call("DEL", leaseKey)

return { "RELEASED" }
`


```

```typescript
export const luaQueueCancel = `
-- KEYS[1] = waitingKey (ZSET)
--
-- ARGV[1] = member
--
-- Returns:
--   { "CANCELLED", removedCount }

local waitingKey = KEYS[1]
local member = ARGV[1]

local removed = redis.call("ZREM", waitingKey, member)
return { "CANCELLED", removed }
`


```

```typescript
import { Effect } from "effect"

export class KeyFactory extends Effect.Service<KeyFactory>()(
  "@blikka/packages/redis-store/key-factory",
  {
    sync: () => ({
      submission: (domain: string, ref: string, formattedOrderIndex: string) =>
        `submission:${domain}:${ref}:${formattedOrderIndex}`,
      exif: (domain: string, ref: string, formattedOrderIndex: string) =>
        `exif:${domain}:${ref}:${formattedOrderIndex}`,
      participant: (domain: string, ref: string) =>
        `participant:${domain}:${ref}`,
      zipProgress: (domain: string, ref: string) =>
        `zip-progress:${domain}:${ref}`,
      uploadQueueWaiting: () => "upload-q:waiting",
      uploadQueueActive: () => "upload-q:active",
      uploadQueueLeasePrefix: () => "upload-q:lease:",
      uploadQueueMember: (domain: string, ref: string) => `${domain}:${ref}`,
    }),
  }
) {}

```

```typescript
import { Duration, Effect, Option, Schedule, Schema } from "effect"
import { RedisClient, RedisError } from "@blikka/redis"
import { KeyFactory } from "../key-factory"
import { luaQueueStatusOrAcquire } from "../lua-scripts/lua-queue-status-or-acquire"
import { luaQueueHeartbeat } from "../lua-scripts/lua-queue-heartbeat"
import { luaQueueRelease } from "../lua-scripts/lua-queue-release"
import { luaQueueCancel } from "../lua-scripts/lua-queue-cancel"

interface WaitResult {
  status: "WAIT"
  position: number
  activeCount: number
  limit: number
  pollAfterMs: number
}

interface GrantedResult {
  status: "GRANTED"
  leaseId: string
  leaseExpiresAtMs: number
  activeCount: number
  limit: number
}

export type UploadQueueResult = WaitResult | GrantedResult

interface HeartbeatOkResult {
  ok: true
  leaseExpiresAtMs: number
}

interface HeartbeatNotOkResult {
  ok: false
  reason: "NOT_ACTIVE" | "LEASE_MISMATCH"
}

export type UploadQueueHeartbeatResult = HeartbeatOkResult | HeartbeatNotOkResult

interface ReleaseResult {
  result: "RELEASED" | "NOT_ACTIVE" | "LEASE_MISMATCH"
}

interface CancelResult {
  removed: number
}

const QueueStatusOrAcquireSchema = Schema.Union(
  Schema.Tuple(
    Schema.Literal("GRANTED"),
    Schema.String,
    Schema.Number,
    Schema.Number,
    Schema.Number
  ),
  Schema.Tuple(
    Schema.Literal("WAIT"),
    Schema.Number,
    Schema.Number,
    Schema.Number,
    Schema.Number
  )
)

const QueueHeartbeatSchema = Schema.Union(
  Schema.Tuple(Schema.Literal("OK"), Schema.Number),
  Schema.Tuple(Schema.Literal("NOT_ACTIVE")),
  Schema.Tuple(Schema.Literal("LEASE_MISMATCH"))
)

const QueueReleaseSchema = Schema.Union(
  Schema.Tuple(Schema.Literal("RELEASED")),
  Schema.Tuple(Schema.Literal("NOT_ACTIVE")),
  Schema.Tuple(Schema.Literal("LEASE_MISMATCH"))
)

const QueueCancelSchema = Schema.Tuple(Schema.Literal("CANCELLED"), Schema.Number)

function mapStatusOrAcquireResult(
  result: typeof QueueStatusOrAcquireSchema.Type
): UploadQueueResult {
  if (result[0] === "GRANTED") {
    const [, leaseId, leaseExpiresAtMs, activeCount, limit] = result
    return {
      status: "GRANTED",
      leaseId,
      leaseExpiresAtMs,
      activeCount,
      limit,
    }
  }
  const [, position, activeCount, limit, pollAfterMs] = result
  return {
    status: "WAIT",
    position,
    activeCount,
    limit,
    pollAfterMs,
  }
}

function mapHeartbeatResult(result: typeof QueueHeartbeatSchema.Type): UploadQueueHeartbeatResult {
  switch (result[0]) {
    case "OK":
      return { ok: true, leaseExpiresAtMs: result[1] }
    case "NOT_ACTIVE":
    case "LEASE_MISMATCH":
      return { ok: false, reason: result[0] }
  }
}

function mapReleaseResult(result: typeof QueueReleaseSchema.Type): ReleaseResult {
  return { result: result[0] }
}

function mapCancelResult(result: typeof QueueCancelSchema.Type): CancelResult {
  return { removed: result[1] }
}

export class UploadQueueRepository extends Effect.Service<UploadQueueRepository>()(
  "@blikka/packages/kv-store/upload-queue-repository",
  {
    dependencies: [RedisClient.Default, KeyFactory.Default],
    effect: Effect.gen(function* () {
      const redis = yield* RedisClient
      const keyFactory = yield* KeyFactory

      const statusOrAcquire = Effect.fn("UploadQueueRepository.statusOrAcquire")(function* (args: {
        domain: string
        reference: string
        limit: number
        leaseTtlMs: number
        pollMinMs?: number
      }) {
        const member = keyFactory.uploadQueueMember(args.domain, args.reference)
        const waitingKey = keyFactory.uploadQueueWaiting()
        const activeKey = keyFactory.uploadQueueActive()
        const leaseKeyPrefix = keyFactory.uploadQueueLeasePrefix()
        const pollMinMs = args.pollMinMs ?? 1000

        const [raw] = yield* redis.use((client) =>
          client.eval<unknown[], string[]>(
            luaQueueStatusOrAcquire,
            [waitingKey, activeKey],
            [member, String(args.limit), String(args.leaseTtlMs), leaseKeyPrefix, String(pollMinMs)]
          )
        )

        const decoded = yield* Schema.decodeUnknown(QueueStatusOrAcquireSchema)(raw)
        return mapStatusOrAcquireResult(decoded)
      }).pipe(
        Effect.mapError(
          (error) =>
            new RedisError({
              message: "Failed to statusOrAcquire upload queue slot",
              cause: error,
            })
        ),
        Effect.retry(
          Schedule.compose(Schedule.exponential(Duration.millis(100)), Schedule.recurs(3))
        )
      )

      const heartbeat = Effect.fn("UploadQueueRepository.heartbeat")(function* (args: {
        domain: string
        reference: string
        leaseId: string
        leaseTtlMs: number
      }) {
        const member = keyFactory.uploadQueueMember(args.domain, args.reference)
        const activeKey = keyFactory.uploadQueueActive()
        const leaseKeyPrefix = keyFactory.uploadQueueLeasePrefix()

        const [raw] = yield* redis.use((client) =>
          client.eval<unknown[], string[]>(
            luaQueueHeartbeat,
            [activeKey],
            [member, args.leaseId, String(args.leaseTtlMs), leaseKeyPrefix]
          )
        )

        const decoded = yield* Schema.decodeUnknown(QueueHeartbeatSchema)(raw)
        return mapHeartbeatResult(decoded)
      }).pipe(
        Effect.mapError(
          (error) =>
            new RedisError({
              message: "Failed to heartbeat upload queue slot",
              cause: error,
            })
        ),
        Effect.retry(
          Schedule.compose(Schedule.exponential(Duration.millis(100)), Schedule.recurs(3))
        )
      )

      const release = Effect.fn("UploadQueueRepository.release")(function* (args: {
        domain: string
        reference: string
        leaseId: string
      }) {
        const member = keyFactory.uploadQueueMember(args.domain, args.reference)
        const activeKey = keyFactory.uploadQueueActive()
        const leaseKeyPrefix = keyFactory.uploadQueueLeasePrefix()

        const [raw] = yield* redis.use((client) =>
          client.eval<unknown[], string[]>(
            luaQueueRelease,
            [activeKey],
            [member, args.leaseId, leaseKeyPrefix]
          )
        )

        const decoded = yield* Schema.decodeUnknown(QueueReleaseSchema)(raw)
        return mapReleaseResult(decoded)
      }).pipe(
        Effect.mapError(
          (error) =>
            new RedisError({
              message: "Failed to release upload queue slot",
              cause: error,
            })
        ),
        Effect.retry(
          Schedule.compose(Schedule.exponential(Duration.millis(100)), Schedule.recurs(3))
        )
      )

      const cancel = Effect.fn("UploadQueueRepository.cancel")(function* (args: {
        domain: string
        reference: string
      }) {
        const member = keyFactory.uploadQueueMember(args.domain, args.reference)
        const waitingKey = keyFactory.uploadQueueWaiting()

        const [raw] = yield* redis.use((client) =>
          client.eval<unknown[], string[]>(luaQueueCancel, [waitingKey], [member])
        )

        const decoded = yield* Schema.decodeUnknown(QueueCancelSchema)(raw)
        return mapCancelResult(decoded)
      }).pipe(
        Effect.mapError(
          (error) =>
            new RedisError({
              message: "Failed to cancel upload queue slot",
              cause: error,
            })
        ),
        Effect.retry(
          Schedule.compose(Schedule.exponential(Duration.millis(100)), Schedule.recurs(3))
        )
      )

      const getLeaseId = Effect.fn("UploadQueueRepository.getLeaseId")(function* (args: {
        domain: string
        reference: string
      }) {
        const leaseKeyPrefix = keyFactory.uploadQueueLeasePrefix()
        const member = keyFactory.uploadQueueMember(args.domain, args.reference)
        const leaseId = yield* redis.use((client) => client.get<string>(leaseKeyPrefix + member))
        return Option.fromNullable(leaseId)
      }).pipe(
        Effect.mapError(
          (error) =>
            new RedisError({
              message: "Failed to get upload queue lease id",
              cause: error,
            })
        )
      )

      return {
        statusOrAcquire,
        heartbeat,
        release,
        cancel,
        getLeaseId,
      } as const
    }),
  }
) {}


```

```typescript
import { Effect } from "effect"
import { UploadSessionRepository } from "./repos/upload-session-repository"
import { ZipKVRepository } from "./repos/zip-kv-repository"
import { ExifKVRepository } from "./repos/exif-kv-repository"
import { UploadQueueRepository } from "./repos/upload-queue-repository"

export * from "./repos/upload-session-repository"
export * from "./repos/zip-kv-repository"
export * from "./repos/exif-kv-repository"
export * from "./repos/upload-queue-repository"
export * from "./key-factory"
export * from "./schema"

export class KVStore extends Effect.Service<KVStore>()("@blikka/packages/kv-store", {
  dependencies: [
    UploadSessionRepository.Default,
    ZipKVRepository.Default,
    ExifKVRepository.Default,
    UploadQueueRepository.Default,
  ],
  effect: Effect.gen(function* () {
    const uploadRepository = yield* UploadSessionRepository
    const zipRepository = yield* ZipKVRepository
    const exifRepository = yield* ExifKVRepository
    const uploadQueueRepository = yield* UploadQueueRepository

    return {
      uploadRepository,
      zipRepository,
      exifRepository,
      uploadQueueRepository,
    }
  }),
}) {}

```

Good: kv-store doesn’t have a typecheck script, but lints are clean and the new files mirror existing repo patterns (Effect.Service + Redis eval + Schema decoding). Next I’ll run a `tsc` check via the package’s tsconfig to confirm there are no TS errors, then I’ll summarize the new repository API and where to call it (TRPC + upload-finalizer).

Nice catch from `tsc`: `Effect.fn(...)` returns a function, so chaining `.pipe(...)` was invalid. I’m going to refactor each repo method to use the same pattern as your existing `UploadSessionRepository`—passing `mapError/retry` as arguments to `Effect.fn`—then re-run `tsc` to confirm it’s clean.

```typescript
import { Duration, Effect, Option, Schedule, Schema } from "effect"
import { RedisClient, RedisError } from "@blikka/redis"
import { KeyFactory } from "../key-factory"
import { luaQueueStatusOrAcquire } from "../lua-scripts/lua-queue-status-or-acquire"
import { luaQueueHeartbeat } from "../lua-scripts/lua-queue-heartbeat"
import { luaQueueRelease } from "../lua-scripts/lua-queue-release"
import { luaQueueCancel } from "../lua-scripts/lua-queue-cancel"

interface WaitResult {
  status: "WAIT"
  position: number
  activeCount: number
  limit: number
  pollAfterMs: number
}

interface GrantedResult {
  status: "GRANTED"
  leaseId: string
  leaseExpiresAtMs: number
  activeCount: number
  limit: number
}

export type UploadQueueResult = WaitResult | GrantedResult

interface HeartbeatOkResult {
  ok: true
  leaseExpiresAtMs: number
}

interface HeartbeatNotOkResult {
  ok: false
  reason: "NOT_ACTIVE" | "LEASE_MISMATCH"
}

export type UploadQueueHeartbeatResult = HeartbeatOkResult | HeartbeatNotOkResult

interface ReleaseResult {
  result: "RELEASED" | "NOT_ACTIVE" | "LEASE_MISMATCH"
}

interface CancelResult {
  removed: number
}

const QueueStatusOrAcquireSchema = Schema.Union(
  Schema.Tuple(
    Schema.Literal("GRANTED"),
    Schema.String,
    Schema.Number,
    Schema.Number,
    Schema.Number
  ),
  Schema.Tuple(
    Schema.Literal("WAIT"),
    Schema.Number,
    Schema.Number,
    Schema.Number,
    Schema.Number
  )
)

const QueueHeartbeatSchema = Schema.Union(
  Schema.Tuple(Schema.Literal("OK"), Schema.Number),
  Schema.Tuple(Schema.Literal("NOT_ACTIVE")),
  Schema.Tuple(Schema.Literal("LEASE_MISMATCH"))
)

const QueueReleaseSchema = Schema.Union(
  Schema.Tuple(Schema.Literal("RELEASED")),
  Schema.Tuple(Schema.Literal("NOT_ACTIVE")),
  Schema.Tuple(Schema.Literal("LEASE_MISMATCH"))
)

const QueueCancelSchema = Schema.Tuple(Schema.Literal("CANCELLED"), Schema.Number)

function mapStatusOrAcquireResult(
  result: typeof QueueStatusOrAcquireSchema.Type
): UploadQueueResult {
  if (result[0] === "GRANTED") {
    const [, leaseId, leaseExpiresAtMs, activeCount, limit] = result
    return {
      status: "GRANTED",
      leaseId,
      leaseExpiresAtMs,
      activeCount,
      limit,
    }
  }
  const [, position, activeCount, limit, pollAfterMs] = result
  return {
    status: "WAIT",
    position,
    activeCount,
    limit,
    pollAfterMs,
  }
}

function mapHeartbeatResult(result: typeof QueueHeartbeatSchema.Type): UploadQueueHeartbeatResult {
  switch (result[0]) {
    case "OK":
      return { ok: true, leaseExpiresAtMs: result[1] }
    case "NOT_ACTIVE":
    case "LEASE_MISMATCH":
      return { ok: false, reason: result[0] }
  }
}

function mapReleaseResult(result: typeof QueueReleaseSchema.Type): ReleaseResult {
  return { result: result[0] }
}

function mapCancelResult(result: typeof QueueCancelSchema.Type): CancelResult {
  return { removed: result[1] }
}

export class UploadQueueRepository extends Effect.Service<UploadQueueRepository>()(
  "@blikka/packages/kv-store/upload-queue-repository",
  {
    dependencies: [RedisClient.Default, KeyFactory.Default],
    effect: Effect.gen(function* () {
      const redis = yield* RedisClient
      const keyFactory = yield* KeyFactory

      const statusOrAcquire = Effect.fn(
        "UploadQueueRepository.statusOrAcquire"
      )(
        function* (args: {
          domain: string
          reference: string
          limit: number
          leaseTtlMs: number
          pollMinMs?: number
        }) {
          const member = keyFactory.uploadQueueMember(args.domain, args.reference)
          const waitingKey = keyFactory.uploadQueueWaiting()
          const activeKey = keyFactory.uploadQueueActive()
          const leaseKeyPrefix = keyFactory.uploadQueueLeasePrefix()
          const pollMinMs = args.pollMinMs ?? 1000

          const [raw] = yield* redis.use((client) =>
            client.eval<unknown[], string[]>(
              luaQueueStatusOrAcquire,
              [waitingKey, activeKey],
              [
                member,
                String(args.limit),
                String(args.leaseTtlMs),
                leaseKeyPrefix,
                String(pollMinMs),
              ]
            )
          )

          const decoded = yield* Schema.decodeUnknown(QueueStatusOrAcquireSchema)(raw)
          return mapStatusOrAcquireResult(decoded)
        },
        Effect.mapError(
          (error) =>
            new RedisError({
              message: "Failed to statusOrAcquire upload queue slot",
              cause: error,
            })
        ),
        Effect.retry(
          Schedule.compose(Schedule.exponential(Duration.millis(100)), Schedule.recurs(3))
        )
      )

      const heartbeat = Effect.fn("UploadQueueRepository.heartbeat")(
        function* (args: { domain: string; reference: string; leaseId: string; leaseTtlMs: number }) {
          const member = keyFactory.uploadQueueMember(args.domain, args.reference)
          const activeKey = keyFactory.uploadQueueActive()
          const leaseKeyPrefix = keyFactory.uploadQueueLeasePrefix()

          const [raw] = yield* redis.use((client) =>
            client.eval<unknown[], string[]>(
              luaQueueHeartbeat,
              [activeKey],
              [member, args.leaseId, String(args.leaseTtlMs), leaseKeyPrefix]
            )
          )

          const decoded = yield* Schema.decodeUnknown(QueueHeartbeatSchema)(raw)
          return mapHeartbeatResult(decoded)
        },
        Effect.mapError(
          (error) =>
            new RedisError({
              message: "Failed to heartbeat upload queue slot",
              cause: error,
            })
        ),
        Effect.retry(
          Schedule.compose(Schedule.exponential(Duration.millis(100)), Schedule.recurs(3))
        )
      )

      const release = Effect.fn("UploadQueueRepository.release")(
        function* (args: { domain: string; reference: string; leaseId: string }) {
          const member = keyFactory.uploadQueueMember(args.domain, args.reference)
          const activeKey = keyFactory.uploadQueueActive()
          const leaseKeyPrefix = keyFactory.uploadQueueLeasePrefix()

          const [raw] = yield* redis.use((client) =>
            client.eval<unknown[], string[]>(
              luaQueueRelease,
              [activeKey],
              [member, args.leaseId, leaseKeyPrefix]
            )
          )

          const decoded = yield* Schema.decodeUnknown(QueueReleaseSchema)(raw)
          return mapReleaseResult(decoded)
        },
        Effect.mapError(
          (error) =>
            new RedisError({
              message: "Failed to release upload queue slot",
              cause: error,
            })
        ),
        Effect.retry(
          Schedule.compose(Schedule.exponential(Duration.millis(100)), Schedule.recurs(3))
        )
      )

      const cancel = Effect.fn("UploadQueueRepository.cancel")(
        function* (args: { domain: string; reference: string }) {
          const member = keyFactory.uploadQueueMember(args.domain, args.reference)
          const waitingKey = keyFactory.uploadQueueWaiting()

          const [raw] = yield* redis.use((client) =>
            client.eval<unknown[], string[]>(luaQueueCancel, [waitingKey], [member])
          )

          const decoded = yield* Schema.decodeUnknown(QueueCancelSchema)(raw)
          return mapCancelResult(decoded)
        },
        Effect.mapError(
          (error) =>
            new RedisError({
              message: "Failed to cancel upload queue slot",
              cause: error,
            })
        ),
        Effect.retry(
          Schedule.compose(Schedule.exponential(Duration.millis(100)), Schedule.recurs(3))
        )
      )

      const getLeaseId = Effect.fn("UploadQueueRepository.getLeaseId")(
        function* (args: { domain: string; reference: string }) {
          const leaseKeyPrefix = keyFactory.uploadQueueLeasePrefix()
          const member = keyFactory.uploadQueueMember(args.domain, args.reference)
          const leaseId = yield* redis.use((client) => client.get<string>(leaseKeyPrefix + member))
          return Option.fromNullable(leaseId)
        },
        Effect.mapError(
          (error) =>
            new RedisError({
              message: "Failed to get upload queue lease id",
              cause: error,
            })
        )
      )

      return {
        statusOrAcquire,
        heartbeat,
        release,
        cancel,
        getLeaseId,
      } as const
    }),
  }
) {}



```

### ✅ Implemented: fair upload queue KV store in `@blikka/kv-store`

#### What I added
- **Lua scripts** (Redis ZSET queue + active leases):
  - `lua-queue-status-or-acquire.ts`: enqueue (NX), cleanup expired actives, promote *head-of-line* while capacity, return `WAIT` (with position) or `GRANTED` (with lease)
  - `lua-queue-heartbeat.ts`: extend lease if `leaseId` matches
  - `lua-queue-release.ts`: release active slot if `leaseId` matches
  - `lua-queue-cancel.ts`: remove from waiting queue

- **New repository**: `UploadQueueRepository` in `packages/kv-store/src/repos/upload-queue-repository.ts`
  - `statusOrAcquire({ domain, reference, limit, leaseTtlMs, pollMinMs? })`
  - `heartbeat({ domain, reference, leaseId, leaseTtlMs })`
  - `release({ domain, reference, leaseId })`
  - `cancel({ domain, reference })`
  - `getLeaseId({ domain, reference })`

- **KeyFactory additions** in `packages/kv-store/src/key-factory.ts`:
  - `uploadQueueWaiting()`, `uploadQueueActive()`, `uploadQueueLeasePrefix()`, `uploadQueueMember(domain, ref)`

- **Exports + wiring** in `packages/kv-store/src/index.ts`:
  - exported the new repo
  - added it to `KVStore` as `uploadQueueRepository`

#### Verified
- **`tsc --noEmit` passes** for `packages/kv-store` (ran outside sandbox).

### Next step (when you’re ready)
This repository is now ready to be consumed by:
- `api-v2` TRPC `initializeUploadFlow` to return `WAIT | GRANTED` (fair queue gate before presigned URLs)
- `tasks/upload-finalizer` to call `release(...)` at your TODO (and optionally heartbeat from client while uploading)

