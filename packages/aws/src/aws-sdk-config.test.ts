import { assert, describe, it } from "@effect/vitest"
import { ConfigProvider, Effect, Layer } from "effect"

import {
  AwsSdkConfig,
  AwsSdkConfigLayer,
  awsSdkClientConstructorOptions,
  type AwsSdkResolvedConfig,
} from "./aws-sdk-config"

describe("awsSdkClientConstructorOptions", () => {
  it("includes only region when credentials are undefined", () => {
    assert.deepStrictEqual(
      awsSdkClientConstructorOptions({
        region: "eu-north-1",
        credentials: undefined,
      }),
      { region: "eu-north-1" },
    )
  })

  it("passes through static credentials when defined", () => {
    const resolved: AwsSdkResolvedConfig = {
      region: "eu-north-1",
      credentials: {
        accessKeyId: "access",
        secretAccessKey: "secret",
        sessionToken: "session",
      },
    }
    assert.deepStrictEqual(awsSdkClientConstructorOptions(resolved), {
      region: "eu-north-1",
      credentials: resolved.credentials,
    })
  })
})

/** ConfigProvider must be available when `AwsSdkConfig` is constructed. */
const configLayerFromMap = (env: Record<string, string>) =>
  AwsSdkConfigLayer.pipe(
    Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(env))),
  )

describe("AwsSdkConfig", () => {
  it.effect("resolves region-only config", () =>
    Effect.gen(function* () {
      const c = yield* AwsSdkConfig
      assert.strictEqual(c.region, "eu-north-1")
      assert.strictEqual(c.credentials, undefined)
    }).pipe(Effect.provide(configLayerFromMap({ AWS_REGION: "eu-north-1" }))),
  )

  it.effect("builds credentials when access key pair and session token are present", () =>
    Effect.gen(function* () {
      const c = yield* AwsSdkConfig
      assert.deepStrictEqual(c.credentials, {
        accessKeyId: "aid",
        secretAccessKey: "sec",
        sessionToken: "tok",
      })
    }).pipe(
      Effect.provide(
        configLayerFromMap({
          AWS_REGION: "eu-north-1",
          AWS_ACCESS_KEY_ID: "aid",
          AWS_SECRET_ACCESS_KEY: "sec",
          AWS_SESSION_TOKEN: "tok",
        }),
      ),
    ),
  )

  it.effect("omits session token when absent", () =>
    Effect.gen(function* () {
      const c = yield* AwsSdkConfig
      assert.deepStrictEqual(c.credentials, {
        accessKeyId: "aid",
        secretAccessKey: "sec",
      })
    }).pipe(
      Effect.provide(
        configLayerFromMap({
          AWS_REGION: "eu-north-1",
          AWS_ACCESS_KEY_ID: "aid",
          AWS_SECRET_ACCESS_KEY: "sec",
        }),
      ),
    ),
  )

  it.effect("omits credentials when only access key id is set", () =>
    Effect.gen(function* () {
      const c = yield* AwsSdkConfig
      assert.strictEqual(c.credentials, undefined)
    }).pipe(
      Effect.provide(
        configLayerFromMap({
          AWS_REGION: "eu-north-1",
          AWS_ACCESS_KEY_ID: "only-id",
        }),
      ),
    ),
  )
})
