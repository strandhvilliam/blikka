import { IconArrowLeft } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { ballotQuery } from "@/api/ballots.ts";
import { entryCompetitionQuery, participantBallotAuth } from "@/api/entry.ts";
import { BallotView } from "@/components/BallotView.tsx";

export const Route = createFileRoute("/e/$slug_/vote/$ballotId")({
  loader: async ({ context, params }) => {
    const competition = await context.queryClient.ensureQueryData(entryCompetitionQuery(params.slug));

    if (!competition) {
      throw notFound();
    }

    return competition;
  },
  head: ({ loaderData }) => ({ meta: [{ title: loaderData ? `Vote · ${loaderData.name} · Blikka` : "Blikka" }] }),
  component: VotePage,
});

function VotePage() {
  const competition = Route.useLoaderData();
  const { slug, ballotId } = Route.useParams();
  const auth = participantBallotAuth(competition.id);
  const { data: detail, isPending } = useQuery(ballotQuery(auth, ballotId));

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-6 px-4 py-8 md:px-8">
      <Link
        to="/e/$slug"
        params={{ slug }}
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground no-underline hover:text-foreground"
      >
        <IconArrowLeft aria-hidden className="size-4" />
        {competition.name}
      </Link>
      {detail && <BallotView auth={auth} detail={detail} />}
      {!isPending && !detail && (
        <p className="text-sm text-muted-foreground">This vote isn't open to you. Go back to the event to see yours.</p>
      )}
    </main>
  );
}
