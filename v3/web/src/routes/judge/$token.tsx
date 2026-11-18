import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ballotQuery, ballotsQuery, jurorAuth } from "@/api/ballots.ts";
import { BallotView } from "@/components/BallotView.tsx";

export const Route = createFileRoute("/judge/$token")({
  head: () => ({ meta: [{ title: "Judging · Blikka" }, { name: "robots", content: "noindex" }] }),
  component: JurorPage,
});

function JurorPage() {
  const { token } = Route.useParams();
  const auth = jurorAuth(token);
  const { data: ballots } = useQuery(ballotsQuery(auth));
  const ballot = ballots?.[0];
  const { data: detail } = useQuery({ ...ballotQuery(auth, ballot?.id ?? ""), enabled: !!ballot });

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-6 px-4 py-8 md:px-8">
      {ballots && !ballot && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <h1 className="text-xl font-semibold">This link doesn't work</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            It may have been replaced or removed. Ask the organizer for a new link.
          </p>
        </div>
      )}
      {detail && <BallotView auth={auth} detail={detail} />}
    </main>
  );
}
