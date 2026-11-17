import { useMutation } from "@tanstack/react-query";
import { Link, createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@ui-sdk/react/button";
import { isApiError } from "@/api/client.ts";
import { createCompetitionMutation } from "@/api/competitions.ts";
import { organizationQuery } from "@/api/organizations.ts";
import { EventNameStep } from "@/components/EventNameStep.tsx";
import { setupQuestions } from "@/lib/setupQuestions.ts";

// Outside the organization layout (the trailing _), so the setup has the page to itself.
export const Route = createFileRoute("/dashboard/$organizationId_/events/new")({
  beforeLoad: async ({ context, params }) => {
    const organization = await context.queryClient.ensureQueryData(organizationQuery(params.organizationId));

    if (!organization) {
      throw notFound();
    }

    return { organization };
  },
  component: NewEvent,
});

// The name creates the event as a draft, and the setup's other questions update it (adr/0009).
function NewEvent() {
  const { organization } = Route.useRouteContext();
  const navigate = useNavigate();
  const create = useMutation(createCompetitionMutation(organization.id));
  const [name, setName] = useState("");
  const questions = setupQuestions({ topics: 0, inSequence: false });

  return (
    <main className="flex min-h-svh flex-col p-6">
      <Button
        className="self-start no-underline"
        render={<Link to="/dashboard/$organizationId" params={{ organizationId: organization.id }} />}
      >
        Cancel
      </Button>
      <div className="flex w-full flex-1 items-center justify-center py-6">
        <EventNameStep
          value={name}
          onChange={setName}
          progress={[1, questions.length]}
          submit={() =>
            create.mutateAsync({ name: name.trim(), time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone }).then(
              (competition) =>
                navigate({
                  to: "/dashboard/$organizationId/events/$competitionId/setup/$step",
                  params: { organizationId: organization.id, competitionId: competition.id, step: "topics" },
                }),
              (error) =>
                isApiError(error, "CompetitionNameTaken")
                  ? "That name is taken. Try another."
                  : "Couldn't create the event. Try again.",
            )
          }
        />
      </div>
    </main>
  );
}
