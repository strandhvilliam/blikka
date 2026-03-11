import { Page, decodeParams } from "@/lib/next-utils";
import { Effect, Schema } from "effect";
import { HydrateClient, prefetch, trpc } from "@/lib/trpc/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { StaffLaptopUploadClient } from "./_components/staff-laptop-upload-client";

const _StaffLaptopUploadPage = Effect.fn("@blikka/web/StaffLaptopUploadPage")(
  function* ({ params }: PageProps<"/staff/[domain]/laptop-upload">) {
    const { domain } = yield* decodeParams(
      Schema.Struct({ domain: Schema.String }),
    )(params);

    prefetch(trpc.marathons.getByDomain.queryOptions({ domain }));

    return (
      <HydrateClient>
        <Suspense
          fallback={
            <div className="min-h-screen bg-[#f7f5ef] px-6 py-10">
              <div className="mx-auto max-w-7xl space-y-6">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-48 w-full rounded-[2rem]" />
                <Skeleton className="h-[520px] w-full rounded-[2rem]" />
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

