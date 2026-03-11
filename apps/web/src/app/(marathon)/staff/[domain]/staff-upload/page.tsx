import { Page, decodeParams } from "@/lib/next-utils";
import { Effect, Schema } from "effect";
import { HydrateClient, prefetch, trpc } from "@/lib/trpc/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { StaffLaptopUploadClient } from "./_components/staff-laptop-upload-client";

const _StaffLaptopUploadPage = Effect.fn("@blikka/web/StaffLaptopUploadPage")(
  function* ({ params }: PageProps<"/staff/[domain]/staff-upload">) {
    const { domain } = yield* decodeParams(
      Schema.Struct({ domain: Schema.String }),
    )(params);

    prefetch(trpc.marathons.getByDomain.queryOptions({ domain }));

    return (
      <HydrateClient>
        <Suspense
          fallback={
            <div className="relative min-h-screen">
              <div className="border-b border-border bg-background/80 backdrop-blur-lg">
                <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
                  <Skeleton className="h-8 w-20 rounded-full" />
                  <Skeleton className="h-7 w-48" />
                  <Skeleton className="h-7 w-16 rounded-full" />
                </div>
              </div>
              <div className="mx-auto max-w-3xl px-6 py-16">
                <div className="flex flex-col items-center space-y-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-10 w-72" />
                  <Skeleton className="h-4 w-56" />
                  <Skeleton className="mt-6 h-16 w-72 rounded-2xl" />
                </div>
              </div>
            </div>
          }
        >
          <StaffLaptopUploadClient />
        </Suspense>
      </HydrateClient>
    );
  },
  Effect.catch((error) => Effect.succeed(<div>Error: {error.message}</div>)),
);

export default Page(_StaffLaptopUploadPage);
