import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useId, useState } from "react";
import { api } from "../../../api.ts";
import { ConfirmDialog } from "../../../components/ConfirmDialog.tsx";
import { Button } from "../../../components/ui/Button.tsx";
import { Input } from "../../../components/ui/Input.tsx";
import { Label } from "../../../components/ui/Label.tsx";
import { useRefreshOrganization } from "../../../organizations.ts";

export const Route = createFileRoute("/dashboard/$organizationId/settings")({
  component: Settings,
});

function Settings() {
  const { organization } = Route.useRouteContext();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 p-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      {/* key: a rename elsewhere resets the field to the new name. */}
      <Rename
        key={organization.name}
        organization={organization}
        canWrite={organization.permissions.includes("organization:write")}
      />
      {organization.role === "owner" && <Delete organization={organization} />}
    </main>
  );
}

function Rename({ organization, canWrite }: { organization: { id: string; name: string }; canWrite: boolean }) {
  const id = useId();
  const refreshOrganization = useRefreshOrganization();
  const [name, setName] = useState(organization.name);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const unchanged = name.trim() === organization.name;

  return (
    <form
      className="grid max-w-md gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        const { data } = await api().PATCH("/organizations/{id}", {
          params: { path: { id: organization.id } },
          body: { name: name.trim() },
        });
        if (data) await refreshOrganization(organization.id);
        else setError("Couldn't save the name. Try again.");
        setSaving(false);
      }}
    >
      <Label htmlFor={id}>Organization name</Label>
      <Input
        id={id}
        required
        maxLength={100}
        disabled={!canWrite}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setError(undefined);
        }}
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {canWrite && (
        <Button type="submit" className="justify-self-start" disabled={saving || unchanged || !name.trim()}>
          Save
        </Button>
      )}
    </form>
  );
}

function Delete({ organization }: { organization: { id: string; name: string } }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <section className="flex flex-col items-start gap-3">
      <div>
        <h2 className="font-medium">Delete organization</h2>
        <p className="text-sm text-muted-foreground">Its events and everyone's access to them go with it.</p>
      </div>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Delete organization
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Delete ${organization.name}?`}
        description="Its events go with it, and no member can reach it any more. This can't be undone here."
        action="Delete organization"
        onConfirm={async () => {
          const { response } = await api().DELETE("/organizations/{id}", {
            params: { path: { id: organization.id } },
          });
          if (!response.ok) return "Couldn't delete the organization. Try again.";
          queryClient.removeQueries({ queryKey: ["organizations", organization.id] });
          await navigate({ to: "/dashboard" });
        }}
      />
    </section>
  );
}
