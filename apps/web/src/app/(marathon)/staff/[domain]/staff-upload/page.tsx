import { getAppSession } from "@/lib/auth/server";
import { Page, decodeParams } from "@/lib/next-utils";
import { Effect, Option, Schema } from "effect";
import { HydrateClient, prefetch, trpc } from "@/lib/trpc/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { StaffLaptopUploadClient } from "./_components/staff-laptop-upload-client";

const _StaffLaptopUploadPage = Effect.fn("@blikka/web/StaffLaptopUploadPage")(
  function* ({ params }: PageProps<"/staff/[domain]/staff-upload">) {
    const { domain } = yield* decodeParams(
      Schema.Struct({ domain: Schema.String }),
    )(params);
    const session = yield* getAppSession();

    if (Option.isNone(session)) {
      return <div />;
    }

    prefetch(trpc.marathons.getByDomain.queryOptions({ domain }));

    return (
      <HydrateClient>
        <Suspense
          fallback={
            <div className="relative min-h-screen">
              <div className="border-b border-border bg-background/80 backdrop-blur-lg">
                <div className="mx-auto grid max-w-3xl grid-cols-[auto_1fr_auto] items-center gap-3 px-6 py-4">
                  <Skeleton className="h-8 w-20 rounded-full" />
                  <div className="flex justify-center">
                    <Skeleton className="h-7 w-48 rounded-full" />
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="hidden h-4 w-28 sm:block" />
                    <Skeleton className="h-7 w-7 rounded-full" />
                  </div>
                </div>
              </div>
              <div className="mx-auto max-w-3xl px-6 py-16">
                <div className="flex flex-col items-center space-y-4">
                  <Skeleton className="h-8 w-20 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-10 w-72" />
                  <Skeleton className="h-4 w-56" />
                  <Skeleton className="mt-6 h-16 w-72 rounded-2xl" />
                </div>
              </div>
            </div>
          }
        >
          <StaffLaptopUploadClient
            staffName={session.value.user.name ?? session.value.user.email}
            staffEmail={session.value.user.email}
            staffImage={session.value.user.image ?? null}
          />
        </Suspense>
      </HydrateClient>
    );
  },
  Effect.catch((error) => Effect.succeed(<div>Error: {error.message}</div>)),
);

export default Page(_StaffLaptopUploadPage);
