import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { api } from "../api.ts";

export const Route = createFileRoute("/onboarding")({ component: Onboarding });

function Onboarding() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  // Stays set after success too, so a second click while navigating can't create a second org.
  const [submitting, setSubmitting] = useState(false);

  const createOrganization = async () => {
    setSubmitting(true);
    const { data, response } = await api().POST("/organizations", { body: { name } });
    if (!data) {
      setSubmitting(false);
      return setError(`Could not create the organization: ${response.status}`);
    }
    navigate({ to: "/dashboard/$organizationId", params: { organizationId: data.id } });
  };

  return (
    <main>
      <h1>Create your organization</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          createOrganization();
        }}
      >
        <label>
          Organization name
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button type="submit" disabled={submitting}>
          Create
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
