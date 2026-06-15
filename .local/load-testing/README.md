# By-Camera Load Testing

This workspace contains the production-focused `k6` harness for the by-camera upload flow.

## What It Covers

The main script models the backend-critical flow:

1. `uploadFlow.resolveByCameraParticipantByPhone`
2. `uploadFlow.getPublicMarathon` active topic lookup
3. `uploadFlow.initializeByCameraUpload`
4. Presigned S3 `PUT`
5. `uploadFlow.getUploadStatus`
6. `participants.getPublicParticipantByReference`

It intentionally does not simulate browser rendering, file pickers, HEIC conversion, or realtime subscriptions.

## Files

- `k6/by-camera-upload.js`: primary load script
- `k6/lib/config.js`: env parsing and production safety guard
- `k6/lib/options.js`: scenario profiles and thresholds
- `scripts/create-jpeg-fixture.mjs`: helper for generating four 12 MB JPEG payloads (from `photo-event-1`, `2`, `4`, `5`) without committing binaries; single-file mode still available via env

## Required Environment Variables

- `MARATHON_DOMAIN`
- `DEVICE_GROUP_ID`

## Optional Environment Variables

- `TARGET_BASE_URL`
- `X_MARATHON_DOMAIN`
- `TEST_PHONE_PREFIX`
- `JPEG_FIXTURE_PATH` (if set, only this file is used)
- `JPEG_FIXTURE_PATHS` (comma-separated list; overrides the default four-fixture set when `JPEG_FIXTURE_PATH` is unset)
- `MAX_FINALIZATION_WAIT_MS`
- `RAMP_PROFILE`
- `TEST_CASE`
- `PRODUCTION_ACK`

## Safety Guard

If `TARGET_BASE_URL` is not localhost, the script requires:

```bash
export PRODUCTION_ACK=I_UNDERSTAND_PRODUCTION_LOAD_TEST
```

## Generate The 12 MB Fixtures

```bash
node .local/load-testing/scripts/create-jpeg-fixture.mjs
```

By default this pads four different source images to 12 MB and writes:

- `.local/load-testing/fixtures/by-camera-12mb-1.jpg` (`photo-event-1.jpg`)
- `.local/load-testing/fixtures/by-camera-12mb-2.jpg` (`photo-event-2.jpg`)
- `.local/load-testing/fixtures/by-camera-12mb-3.jpg` (`photo-event-4.jpg`)
- `.local/load-testing/fixtures/by-camera-12mb-4.jpg` (`photo-event-5.jpg`)

The k6 script rotates across these per VU and iteration so uploads are not all byte-identical.

**Single file (legacy):** set `SOURCE_JPEG_PATH` and optionally `TARGET_JPEG_PATH` — same behavior as before (one padded file). Use your own camera JPEG if you want production-like EXIF and compression behavior.

## Example Commands

Smoke run:

```bash
k6 run .local/load-testing/k6/by-camera-upload.js \
  -e TARGET_BASE_URL=https://your-domain.example \
  -e MARATHON_DOMAIN=your-marathon-domain \
  -e DEVICE_GROUP_ID=1 \
  -e PRODUCTION_ACK=I_UNDERSTAND_PRODUCTION_LOAD_TEST \
  -e RAMP_PROFILE=smoke \
  -e TEST_CASE=happy-path
```

Main run:

```bash
k6 run .local/load-testing/k6/by-camera-upload.js \
  -e TARGET_BASE_URL=https://your-domain.example \
  -e MARATHON_DOMAIN=your-marathon-domain \
  -e DEVICE_GROUP_ID=1 \
  -e PRODUCTION_ACK=I_UNDERSTAND_PRODUCTION_LOAD_TEST \
  -e RAMP_PROFILE=main \
  -e TEST_CASE=happy-path
```

Initialization-only control:

```bash
k6 run .local/load-testing/k6/by-camera-upload.js \
  -e TARGET_BASE_URL=https://your-domain.example \
  -e MARATHON_DOMAIN=your-marathon-domain \
  -e DEVICE_GROUP_ID=1 \
  -e PRODUCTION_ACK=I_UNDERSTAND_PRODUCTION_LOAD_TEST \
  -e RAMP_PROFILE=smoke \
  -e TEST_CASE=initialization-only
```

Upload-only control:

```bash
k6 run .local/load-testing/k6/by-camera-upload.js \
  -e TARGET_BASE_URL=https://your-domain.example \
  -e MARATHON_DOMAIN=your-marathon-domain \
  -e DEVICE_GROUP_ID=1 \
  -e PRODUCTION_ACK=I_UNDERSTAND_PRODUCTION_LOAD_TEST \
  -e RAMP_PROFILE=smoke \
  -e TEST_CASE=upload-only
```

Finalization soak:

```bash
k6 run .local/load-testing/k6/by-camera-upload.js \
  -e TARGET_BASE_URL=https://your-domain.example \
  -e MARATHON_DOMAIN=your-marathon-domain \
  -e DEVICE_GROUP_ID=1 \
  -e PRODUCTION_ACK=I_UNDERSTAND_PRODUCTION_LOAD_TEST \
  -e RAMP_PROFILE=soak \
  -e TEST_CASE=finalization-soak
```

Replacement correctness:

```bash
k6 run .local/load-testing/k6/by-camera-upload.js \
  -e TARGET_BASE_URL=https://your-domain.example \
  -e MARATHON_DOMAIN=your-marathon-domain \
  -e DEVICE_GROUP_ID=1 \
  -e PRODUCTION_ACK=I_UNDERSTAND_PRODUCTION_LOAD_TEST \
  -e TEST_CASE=replacement-correctness
```

## Package Scripts

Local smoke test:

```bash
MARATHON_DOMAIN=your-marathon-domain \
DEVICE_GROUP_ID=1 \
TARGET_BASE_URL=https://your-domain.example \
PRODUCTION_ACK=I_UNDERSTAND_PRODUCTION_LOAD_TEST \
bun run load:by-camera:smoke:local
```

Trigger the deployed Fargate task through SST links:

```bash
SST_STAGE=production \
LOAD_TEST_TARGET_BASE_URL=https://your-domain.example \
LOAD_TEST_MARATHON_DOMAIN=your-marathon-domain \
LOAD_TEST_DEVICE_GROUP_ID=1 \
LOAD_TEST_RAMP_PROFILE=smoke \
LOAD_TEST_CASE=happy-path \
LOAD_TEST_PRODUCTION_ACK=I_UNDERSTAND_PRODUCTION_LOAD_TEST \
bun run load:by-camera:fargate:run
```
