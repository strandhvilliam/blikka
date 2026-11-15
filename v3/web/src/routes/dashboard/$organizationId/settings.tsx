import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useId, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { Label } from "@/components/ui/Label.tsx";
import { deleteOrganizationMutation, renameOrganizationMutation } from "@/api/organizations.ts";

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
  const router = useRouter();
  const rename = useMutation(renameOrganizationMutation(organization.id));
  const [name, setName] = useState(organization.name);
  const unchanged = name.trim() === organization.name;

  return (
    <form
      className="grid max-w-md gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        rename.mutate(name.trim(), { onSuccess: () => router.invalidate() });
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

          if (rename.isError) {
            rename.reset();
          }
        }}
      />
      {rename.isError && (
        <p role="alert" className="text-sm text-destructive">
          Couldn't save the name. Try again.
        </p>
      )}
      {canWrite && (
        <Button
          type="submit"
          className="justify-self-start"
          disabled={rename.isPending || rename.isSuccess || unchanged || !name.trim()}
        >
          Save
        </Button>
      )}
    </form>
  );
}

function Delete({ organization }: { organization: { id: string; name: string } }) {
  const remove = useMutation(deleteOrganizationMutation(organization.id));
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
        onConfirm={() => remove.mutateAsync().then(() => navigate({ to: "/dashboard" }))}
        failure="Couldn't delete the organization. Try again."
      />
    </section>
  );
}
