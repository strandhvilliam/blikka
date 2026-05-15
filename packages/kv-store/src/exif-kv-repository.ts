import { Effect, Schema, Option, Context, Layer } from "effect";
import { Keys } from "./key-factory";
import { RedisClient } from "@blikka/redis";
import { ExifStateSchema, type ExifState } from "./schema";

export class ExifKVRepositoryError extends Schema.TaggedErrorClass<ExifKVRepositoryError>()(
  "ExifKVRepositoryError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export class ExifKVRepository extends Context.Service<ExifKVRepository>()(
  "@blikka/packages/kv-store/exif-kv-repository",
  {
    make: Effect.gen(function* () {
      const redis = yield* RedisClient;

      const getExifState = Effect.fn("ExifKVRepository.getExifState")(
        function* (domain: string, ref: string, orderIndex: number) {
          const key = Keys.exif(domain, ref, orderIndex);
          const result = yield* redis.use((client) =>
            client.get<string | null>(key),
          );
          if (result === null) {
            return Option.none<ExifState>();
          }
          const parsed = Schema.decodeUnknownOption(ExifStateSchema)(result);
          return parsed;
        },
        Effect.mapError((error) => {
          return new ExifKVRepositoryError({
            message: `Failed to get exif state: ${error.message}`,
            cause: error.cause,
          });
        }),
      );

      const getAllExifStates = Effect.fn("ExifKVRepository.getAllExifStates")(
        function* (domain: string, ref: string, orderIndexes: number[]) {
          const keys = orderIndexes.map((orderIndex) =>
            Keys.exif(domain, ref, orderIndex),
          );
          const data = yield* redis.use((client) => client.mget(keys));
          const decodeExifState = Schema.decodeUnknownOption(ExifStateSchema);

          return data.flatMap((item, index) => {
            if (item === null) {
              return [];
            }

            const parsed = decodeExifState(item);
            if (Option.isNone(parsed)) {
              return [];
            }

            return [
              {
                orderIndex: orderIndexes[index]!,
                exif: parsed.value,
              },
            ];
          });
        },
        Effect.orElseSucceed(
          () =>
            [] as {
              orderIndex: number;
              exif: { readonly [x: string]: unknown };
            }[],
        ),
      );

      const setExifState = Effect.fn("ExifKVRepository.setExifState")(
        function* (
          domain: string,
          ref: string,
          orderIndex: number,
          state: ExifState,
        ) {
          const key = Keys.exif(domain, ref, orderIndex);
          return yield* redis.use((client) =>
            client.set(key, JSON.stringify(state)),
          );
        },
        Effect.mapError((error) => {
          return new ExifKVRepositoryError({
            message: `Failed to set exif state`,
            cause: error,
          });
        }),
      );

      const deleteExifStates = Effect.fn("ExifKVRepository.deleteExifStates")(
        function* (
          domain: string,
          ref: string,
          orderIndexes: readonly number[],
        ) {
          if (orderIndexes.length === 0) {
            return 0;
          }

          const keys = Array.from(
            new Set(
              orderIndexes.map((orderIndex) =>
                Keys.exif(domain, ref, orderIndex),
              ),
            ),
          );

          return yield* redis.use((client) => client.del(...keys));
        },
      );

      return {
        getExifState,
        setExifState,
        getAllExifStates,
        deleteExifStates,
      };
    }),
  },
) {
  static layer = Layer.effect(this, this.make).pipe(
    Layer.provide(RedisClient.layer),
  );
}
