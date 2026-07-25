# JPEG-First Photo Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep accepting real professional camera JPEGs (including large ones) while stopping OOM kills from decode peaks — by controlling memory, not by rejecting JPEG file size.

**Architecture:** Treat JPEG acceptance as a product invariant. Cap peak RAM with Sharp decode options, sequential/batched processing, and higher Lambda memory. Reject only absurd non-camera payloads and non-decodable garbage. Client may warn on huge files but must still upload valid JPEGs; preview failures must not fall back to holding the full original in memory.

**Tech Stack:** Sharp (`sharp`), Effect services in `@blikka/image-manipulation` / `@blikka/uploads`, SST Lambda config, Next.js client preview helpers.

## Global Constraints

- **Never reject a decodable JPEG solely because of byte size** in the upload/processing path (marathon `max_file_size` rule stays optional/admin-controlled; do not lower platform defaults in a way that fails pro JPEGs).
- Soft platform ceiling for “this is not a camera JPEG” may exist only at an absurd level (≥ **150 MB**) to stop zip/DoS abuse — document it as abuse protection, not a photo limit.
- Pixel ceiling must fit medium-format sensors: allow at least **120 MP** (`120_000_000` pixels). Reject above that as decompression-bomb / non-camera.
- Thumbnail output stays **512px** wide; contact-sheet cell resize stays as today.
- Do not run SST CLI, drizzle-kit, or app builds to “verify” unless the user asks.
- Prefer failing soft (no thumb / sheet retry) over failing the participant upload for a single heavy JPEG, unless the object is not a decodable JPEG at all.

## Size reality (why not a 5–25 MB reject)

| Source | Typical Fine JPEG | Large-side Fine JPEG |
|---|---|---|
| 24 MP body | ~8–12 MB | ~15–20 MB |
| 45 MP (R5 / A7R IV class) | ~15–25 MB | ~30–40 MB |
| 61 MP | ~20–35 MB | ~40–50 MB |
| ~100 MP medium format | ~25–45 MB | **50–80+ MB** (busy scenes / max quality) |

Decoded RAM dominates compressed size: ~100 MP RGB ≈ **~300 MB** working set per decode, before Sharp intermediates. Contact sheets with 24 originals are the dangerous path, not a single 40 MB JPEG upload.

## File map

| File | Responsibility |
|---|---|
| `packages/image-manipulation/src/constants.ts` | Shared JPEG-first limits (`MAX_INPUT_PIXELS`, optional abuse byte ceiling, Sharp helper flags) |
| `packages/image-manipulation/src/services/sharp-image-service.ts` | Apply `sequentialRead`, `limitInputPixels`, metadata probe; keep resize/prepare APIs |
| `packages/image-manipulation/src/services/contact-sheet-builder.ts` | Lower prepare concurrency; release pressure on peak decode |
| `packages/uploads/src/submission-processor.ts` | Sequential thumb+EXIF for large buffers; optional Head/size-aware path |
| `tasks/upload-processor/src/handler.ts` | Lower in-flight decode concurrency |
| `sst.config.ts` | Raise upload-processor / sheet-generator memory comments + values |
| `apps/web/src/lib/file-processing.ts` | Preview: no full-file object-URL fallback; warn-only for large JPEGs |
| `apps/web/src/lib/contact-sheet/constants.ts` | Raise custom-sheet JPEG budget (or JPEG-exempt) so pro files aren’t blocked in admin UI |
| `apps/web/src/app/api/admin/[domain]/contact-sheet/custom/route.ts` | Sequential buffer handling; same pixel limits via Sharp |

---

### Task 1: Shared JPEG-first limits

**Files:**
- Create: `packages/image-manipulation/src/constants.ts`
- Modify: `packages/image-manipulation/src/index.ts`
- Test: `packages/image-manipulation/src/constants.test.ts` (only if the package already has colocated tests; otherwise export-only — add a tiny unit test next to existing image-manipulation tests if present)

**Interfaces:**
- Produces: `MAX_DECODE_INPUT_PIXELS`, `ABUSE_MAX_OBJECT_BYTES`, `LARGE_JPEG_BYTES_HINT` (client warning only)

- [ ] **Step 1: Add constants**

```ts
/** Allow medium-format ~100MP with headroom; above this treat as bomb / non-camera. */
export const MAX_DECODE_INPUT_PIXELS = 120_000_000

/**
 * Abuse / non-camera ceiling only. Real pro JPEGs are almost always far below this.
 * Do NOT use this as a marathon validation default.
 */
export const ABUSE_MAX_OBJECT_BYTES = 150 * 1024 * 1024

/** Client UX hint only — never block JPEG upload at this threshold. */
export const LARGE_JPEG_BYTES_HINT = 40 * 1024 * 1024
```

- [ ] **Step 2: Re-export from package index**

```ts
export * from './constants'
```

- [ ] **Step 3: Commit**

```bash
git add packages/image-manipulation/src/constants.ts packages/image-manipulation/src/index.ts
git commit -m "$(cat <<'EOF'
feat(image-manipulation): add JPEG-first decode and abuse ceilings

EOF
)"
```

---

### Task 2: Harden Sharp without rejecting pro dimensions

**Files:**
- Modify: `packages/image-manipulation/src/services/sharp-image-service.ts`
- Test: `packages/image-manipulation/src/services/sharp-image-service.test.ts` (create if missing; mock sharp or use tiny fixture buffers)

**Interfaces:**
- Consumes: `MAX_DECODE_INPUT_PIXELS` from `../constants`
- Produces: same `resize` / `prepareForCanvas` / `createCanvasSheet` signatures; internally use:

```ts
sharp(image, {
  sequentialRead: true,
  limitInputPixels: MAX_DECODE_INPUT_PIXELS,
  failOn: 'error',
})
```

- [ ] **Step 1: Write failing test — oversized pixel dimensions are rejected by Sharp options**

Use a test that constructs `sharp` with the service and asserts `limitInputPixels` / `sequentialRead` are passed (spy on `sharp` default export), or integration-style: a tiny valid JPEG still resizes.

```ts
it('configures sharp with sequentialRead and JPEG-safe pixel limit', async () => {
  // spy sharp constructor options; expect limitInputPixels === 120_000_000
  // and sequentialRead === true
})
```

- [ ] **Step 2: Implement in `makeSharpImage`**

Update `makeSharpImage` to pass the options above. Keep `.rotate()` before resize for EXIF orientation.

For `prepareForCanvas`, keep resize-to-cell behavior; `sequentialRead` reduces peak RAM on large JPEGs.

- [ ] **Step 3: Run package tests**

Run: the package’s existing test command (e.g. `pnpm --filter @blikka/image-manipulation test` — use whatever this monorepo uses for that package).

Expected: PASS for new/updated Sharp service tests.

- [ ] **Step 4: Commit**

```bash
git add packages/image-manipulation/src/services/sharp-image-service.ts packages/image-manipulation/src/services/sharp-image-service.test.ts
git commit -m "$(cat <<'EOF'
fix(image-manipulation): decode large JPEGs with sequentialRead and pixel cap

EOF
)"
```

---

### Task 3: Upload-processor — lower peak concurrency, raise memory

**Files:**
- Modify: `tasks/upload-processor/src/handler.ts`
- Modify: `packages/uploads/src/submission-processor.ts`
- Modify: `sst.config.ts` (upload-processor `memory`)
- Test: `packages/uploads/src/submission-processor.test.ts`

**Interfaces:**
- Handler today: `recordConcurrency: 3`, `inputConcurrency: 2` → peak up to **6** full-res buffers/decodes per invocation.
- Target: `recordConcurrency: 2`, `inputConcurrency: 1` → peak **2** photos; EXIF + thumbnail **sequential** inside one photo when `photo.byteLength >= LARGE_JPEG_BYTES_HINT` (or always sequential — simpler and safer).

- [ ] **Step 1: Change handler concurrency**

```ts
// tasks/upload-processor/src/handler.ts
recordConcurrency: 2,
inputConcurrency: 1,
```

- [ ] **Step 2: Sequential artifact pass for large buffers**

In `runPhotoArtifactPass`, replace parallel `Effect.all(..., { concurrency: 2 })` with sequential EXIF then thumbnail when `photo.byteLength >= LARGE_JPEG_BYTES_HINT`, else keep parallel. Simplest JPEG-safe choice: **always sequential** (EXIF then thumb) — latency cost is small vs OOM.

```ts
const exifResult = yield* processExif(...)
const thumbnailResult = yield* generateThumbnail(...)
```

Keep existing `catchCause` soft-fail behavior so a Sharp pixel-limit failure does not block finalize.

- [ ] **Step 3: Raise Lambda memory**

In `sst.config.ts` upload-processor subscriber:

```ts
memory: '3008 MB', // was 2048; headroom for ~100MP JPEG decode + Node
```

Update the comment to say concurrency is now 2×1, memory covers single large Fine JPEG decode.

- [ ] **Step 4: Update/adjust submission-processor tests** if they assumed parallel ordering; run uploads package tests.

- [ ] **Step 5: Commit**

```bash
git add tasks/upload-processor/src/handler.ts packages/uploads/src/submission-processor.ts packages/uploads/src/submission-processor.test.ts sst.config.ts
git commit -m "$(cat <<'EOF'
fix(uploads): process large JPEGs with lower decode concurrency

EOF
)"
```

---

### Task 4: Contact sheet — batch decodes, keep all JPEGs

**Files:**
- Modify: `packages/image-manipulation/src/services/contact-sheet-builder.ts` (`concurrency: 8` → `2`)
- Modify: `packages/uploads/src/contact-sheet-generator.ts` (`getSubmissionFiles` concurrency 5 → 2; optional: process prepare in generator if moved later)
- Modify: `sst.config.ts` sheet-generator memory comment; keep **4096 MB** or raise to **6144 MB** if 24× large Fine JPEGs still risk OOM after concurrency cut
- Test: `packages/uploads/src/contact-sheet-generator.test.ts` (behavior unchanged; only concurrency)

**Rationale:** Do not drop photos from the sheet because they are large JPEGs. Reduce simultaneous `prepareForCanvas` from 8 → 2 so 24×40 MB files still fit.

- [ ] **Step 1: Lower builder concurrency**

```ts
{ concurrency: 2 },
```

- [ ] **Step 2: Lower S3 fan-in**

```ts
{ concurrency: 2 },
```

in `getSubmissionFiles`.

- [ ] **Step 3: Optionally raise sheet Lambda memory to `6144 MB`** if you want belt-and-suspenders for 24×100MP-class compressed buffers (~1–2 GB compressed + decode working set). Prefer concurrency cut first; memory bump second.

- [ ] **Step 4: Run contact-sheet tests; commit**

```bash
git commit -m "$(cat <<'EOF'
fix(contact-sheet): lower decode fan-in so large JPEG sets fit in memory

EOF
)"
```

---

### Task 5: Client — accept large JPEGs; stop full-file preview fallback

**Files:**
- Modify: `apps/web/src/lib/file-processing.ts`
- Modify: `apps/web/src/lib/file-processing.test.ts`
- Optionally: call sites that surface `warnings` from `normalizeSelectedImageFiles` / selection hooks — add warn-only for `file.size >= LARGE_JPEG_BYTES_HINT && jpeg`

**Policy:**
- JPEG/JPG: never skip for size.
- HEIC: keep convert; on failure skip (unchanged).
- Thumbnail: on `createImageBitmap` failure, return a **placeholder data URL or empty string + warning**, never `URL.createObjectURL(file)` for the full original.

- [ ] **Step 1: Failing test for fallback**

```ts
it('does not create a full-file object URL when thumbnail generation fails', async () => {
  vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('decode')))
  const createObjectURL = vi.spyOn(URL, 'createObjectURL')
  await generateThumbnailUrl(new File([big], 'pro.jpg', { type: 'image/jpeg' }))
  expect(createObjectURL).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Implement safe fallback**

```ts
} catch (cause) {
  byCameraThumbnailBreadcrumb('fallback_after_exception', { ... })
  return '' // or a tiny static placeholder constant
}
```

Update callers that assume a non-empty URL to show a generic preview tile when `previewUrl === ''`.

- [ ] **Step 3: Warn-only large JPEG (optional UX)**

When selecting files, if `type` is JPEG and `size >= LARGE_JPEG_BYTES_HINT`, push a warning string like `"pro.jpg: large file — upload may take longer"` — do **not** filter it out of `candidates`.

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
fix(web): keep large JPEG uploads; avoid full-file preview memory fallback

EOF
)"
```

---

### Task 6: Admin custom contact sheet — don’t block pro JPEGs at 25 MB

**Files:**
- Modify: `apps/web/src/lib/contact-sheet/constants.ts`
- Modify: client validation that uses `MAX_IMAGE_FILE_BYTES`
- Modify: `apps/web/src/app/api/admin/[domain]/contact-sheet/custom/route.ts` — apply abuse ceiling only; sequential `arrayBuffer` already; ensure Sharp path uses Task 2 limits

**Policy:**
- Raise `MAX_IMAGE_FILE_BYTES` to `ABUSE_MAX_OBJECT_BYTES` **or** split: JPEG uses abuse ceiling, PNG/WebP stay at 25 MB (PNG bombs are worse).
- Preferred:

```ts
export const MAX_JPEG_FILE_BYTES = 150 * 1024 * 1024
export const MAX_NON_JPEG_IMAGE_FILE_BYTES = 25 * 1024 * 1024
```

Validate per MIME on client + route.

- [ ] **Step 1: Split limits; update UI validation messages**
- [ ] **Step 2: Route rejects only above abuse ceiling / non-decodable Sharp errors (already 500/400)**
- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
fix(web): allow professional JPEG sizes in custom contact sheets

EOF
)"
```

---

### Task 7: Validation defaults — don’t ship a JPEG-hostile size rule

**Files:**
- Modify: `packages/db/src/utils.ts` `getDefaultRuleConfigs` only if product agrees
- Docs note in this plan / existing admin copy

**Policy (pick one, document in commit):**
1. **Keep `max_file_size` disabled** (current) — safest for “never fail JPEGs”.
2. Or enable with `maxBytes: 100 * 1024 * 1024` so it only flags absurd files, not 45 MP Fine JPEGs.

Do **not** enable the current **5 MB** default.

- [ ] **Step 1: If changing defaults, set `maxBytes` to at least `100 * 1024 * 1024` and leave `enabled: false` unless product wants it on**
- [ ] **Step 2: Commit only if code changes**

---

## Out of scope (explicit)

- Rejecting JPEG uploads based on marathon rules without an admin opt-in.
- Moving custom contact-sheet generation to Lambda (nice follow-up; not required if Task 6 + Sharp limits land).
- Streaming S3→Sharp without buffering (bigger refactor; revisit if 150 MB abuse ceiling still OOMs sheet gen).
- Changing gallery/`next/image` display behavior.

## Self-review

1. **Spec coverage:** Accept pro JPEGs → Tasks 3–7 avoid size rejects; OOM → Tasks 2–4; client tab → Task 5; admin 25 MB trap → Task 6.
2. **Placeholder scan:** No TBD steps; constants and concurrency values are concrete.
3. **Type consistency:** Constants names (`MAX_DECODE_INPUT_PIXELS`, `ABUSE_MAX_OBJECT_BYTES`, `LARGE_JPEG_BYTES_HINT`) reused across tasks.

## Success criteria

- A ~45 MP / ~35 MB Fine JPEG uploads, gets a thumbnail, and can appear on an 8- or 24-photo contact sheet without Lambda OOM.
- A ~100 MP / ~60 MB Fine JPEG is accepted (not validation-failed for size by default) and either thumbs successfully or soft-fails thumb only.
- Corrupt non-JPEG bytes still fail soft; >120 MP inputs fail Sharp predictably without killing the host when possible.
- Client selecting a huge JPEG does not pin a full-resolution object URL in memory after preview failure.
