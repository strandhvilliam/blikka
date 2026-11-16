import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@ui-sdk/react/button";
import { Field, FieldError, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { ConfirmDialog } from "@/components/ConfirmDialog.tsx";
import { PageHeader } from "@/components/PageHeader.tsx";
import { Saved, Section } from "@/components/Section.tsx";
import { deleteOrganizationMutation, renameOrganizationMutation } from "@/api/organizations.ts";

export const Route = createFileRoute("/dashboard/$organizationId/settings")({
  component: Settings,
});

function Settings() {
  const { organization } = Route.useRouteContext();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-8">
      <PageHeader title="Settings" description="The organization's name, and deleting it." />
      <div className="flex flex-col gap-6">
        {/* key: a rename elsewhere resets the field to the new name. */}
        <Rename
          key={organization.name}
          organization={organization}
          canWrite={organization.permissions.includes("organization:write")}
        />
        {organization.role === "owner" && <Delete organization={organization} />}
      </div>
    </main>
  );
}

function Rename({ organization, canWrite }: { organization: { id: string; name: string }; canWrite: boolean }) {
  const router = useRouter();
  const rename = useMutation(renameOrganizationMutation(organization.id));
  const [name, setName] = useState(organization.name);
  const unchanged = name.trim() === organization.name;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        rename.mutate(name.trim(), { onSuccess: () => router.invalidate() });
      }}
    >
      <Section
        title="Name"
        description="Shown to members and on every event's entry page."
        footer={
          canWrite && (
            <>
              {rename.isSuccess && unchanged && <Saved />}
              <Button
                type="submit"
                data-variant="solid"
                disabled={rename.isPending || rename.isSuccess || unchanged || !name.trim()}
              >
                Save
              </Button>
            </>
          )
        }
      >
        <Field disabled={!canWrite} invalid={rename.isError ? true : undefined} className="max-w-md">
          <FieldLabel className="sr-only">Organization name</FieldLabel>
          <Input
            required
            maxLength={100}
            value={name}
            onValueChange={(value) => {
              setName(value);

              if (rename.isError) {
                rename.reset();
              }
            }}
          />
          {rename.isError && <FieldError>Couldn't save the name. Try again.</FieldError>}
        </Field>
      </Section>
    </form>
  );
}

function Delete({ organization }: { organization: { id: string; name: string } }) {
  const remove = useMutation(deleteOrganizationMutation(organization.id));
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Section
        tone="danger"
        title="Delete organization"
        description="Its events and everyone's access to them go with it."
        footer={
          <Button data-variant="destructive" onClick={() => setOpen(true)}>
            Delete organization
          </Button>
        }
      />
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Delete ${organization.name}?`}
        description="Its events go with it, and no member can reach it any more. This can't be undone here."
        action="Delete organization"
        onConfirm={() => remove.mutateAsync().then(() => navigate({ to: "/dashboard" }))}
        failure="Couldn't delete the organization. Try again."
      />
    </>
  );
}
