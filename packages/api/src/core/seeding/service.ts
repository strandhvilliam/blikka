import "server-only";

import { Context, Effect, Layer } from "effect";
import { DbLayer } from "@blikka/db";
import { S3ServiceLayer } from "@blikka/aws";
import {
  ContactSheetBuilderLayer,
  SharpImageServiceLayer,
} from "@blikka/image-manipulation";
import { JuryService } from "../jury/service";
import {
  getSeedScenarioStatus,
  seedFinishedScenario,
} from "./finished-scenario";

export class SeedingService extends Context.Service<SeedingService>()(
  "@blikka/api/SeedingService",
  {
    make: Effect.gen(function* () {
      const getStatus = Effect.fn("SeedingService.getStatus")(function* ({
        domain,
        isAdminForDomain,
      }: {
        domain: string;
        isAdminForDomain: boolean;
      }) {
        return yield* getSeedScenarioStatus({
          domain,
          isAdminForDomain,
        });
      });

      const seedFinishedScenarioForDomain = Effect.fn(
        "SeedingService.seedFinishedScenarioForDomain",
      )(function* ({
        domain,
        isAdminForDomain,
      }: {
        domain: string;
        isAdminForDomain: boolean;
      }) {
        return yield* seedFinishedScenario({
          domain,
          isAdminForDomain,
        });
      });

      return {
        getStatus,
        seedFinishedScenarioForDomain,
      } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(
      Layer.mergeAll(
        DbLayer,
        S3ServiceLayer,
        SharpImageServiceLayer,
        ContactSheetBuilderLayer,
        JuryService.layer,
      ),
    ),
  );
}
