import { createFileRoute } from "@tanstack/react-router";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "../../../components/ui/Empty.tsx";

export const Route = createFileRoute("/dashboard/$organizationId/")({ component: Dashboard });

function Dashboard() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Events</h1>
      {/* shortcut: no "New event" button until the Api can create competitions */}
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>No events yet</EmptyTitle>
          <EmptyDescription>Competitions, photo walks and exhibitions you create show up here.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </main>
  );
}
