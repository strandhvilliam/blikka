import { SNSClient } from "@aws-sdk/client-sns";
import { Config, Console, Data, Effect } from "effect";

export class SNSEffectError extends Data.TaggedError("SNSEffectError")<{
  message?: string;
  cause?: unknown;
}> {}

export class SNSEffectClient extends Effect.Service<SNSEffectClient>()(
  "@blikka/sms/sns-client",
  {
    scoped: Effect.gen(function* () {
      const region = yield* Config.string("AWS_REGION");

      const client = new SNSClient({ region });
      const use = <T>(
        fn: (client: SNSClient) => T,
      ): Effect.Effect<Awaited<T>, SNSEffectError, never> =>
        Effect.gen(function* () {
          const result = yield* Effect.try({
            try: () => fn(client),
            catch: (error) =>
              new SNSEffectError({
                cause: error,
                message:
                  error instanceof Error
                    ? error.message
                    : "Unknown error in SNS Effect Client",
              }),
          });
          if (result instanceof Promise) {
            return yield* Effect.tryPromise({
              try: () => result,
              catch: (e) =>
                new SNSEffectError({
                  cause: e,
                  message:
                    e instanceof Error
                      ? e.message
                      : "Unknown error in SNS Effect Client (Async)",
                }),
            });
          }
          return result;
        });

      yield* Effect.addFinalizer(() => Console.log("Shutting down SNS client"));

      return {
        use,
      };
    }),
  },
) {}
