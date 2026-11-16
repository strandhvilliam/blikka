import { IconLink, IconPlus, IconX } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { Link, createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { Button } from "@ui-sdk/react/button";
import { Input } from "@ui-sdk/react/input";
import { Radio, RadioGroup, RadioIndicator } from "@ui-sdk/react/radio";
import { isApiError } from "@/api/client.ts";
import { createCompetitionMutation } from "@/api/competitions.ts";
import { organizationQuery } from "@/api/organizations.ts";
import { Step } from "@/components/Step.tsx";
import { TimeZoneCombobox } from "@/components/TimeZoneCombobox.tsx";
import { WallClockInput } from "@/components/WallClockInput.tsx";
import { slugOf } from "@/lib/slug.ts";
import { formatIn, fromWallClock } from "@/lib/timeZone.ts";

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

const questions = ["name", "topics", "window", "review"] as const;

type Question = (typeof questions)[number];

const progress = (question: Question): [number, number] => [questions.indexOf(question) + 1, questions.length];

// The topic list allows as many as the Api does.
const maxTopics = 100;

const newRow = () => ({ key: crypto.randomUUID(), name: "" });

// The answers stay in the browser until Create, so an abandoned setup leaves nothing behind (adr/0009).
function NewEvent() {
  const { organization } = Route.useRouteContext();
  const navigate = useNavigate();
  const create = useMutation(createCompetitionMutation(organization.id));
  const [question, setQuestion] = useState<Question>("name");
  const [name, setName] = useState("");
  // From Create, shown on the name step it sends you back to.
  const [nameError, setNameError] = useState<string>();
  const [topics, setTopics] = useState(() => [newRow()]);
  const [focused, setFocused] = useState(topics[0]?.key);
  const [schedule, setSchedule] = useState<"dates" | "by-hand" | null>(null);
  const [opens, setOpens] = useState("");
  const [closes, setCloses] = useState("");
  const [timeZone, setTimeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);

  const named = topics.map((topic) => topic.name.trim()).filter(Boolean);
  const opensAt = schedule === "dates" && opens ? fromWallClock(opens, timeZone) : undefined;
  const closesAt = schedule === "dates" && closes ? fromWallClock(closes, timeZone) : undefined;

  const addAfter = (index: number) => {
    const row = newRow();
    setTopics([...topics.slice(0, index + 1), row, ...topics.slice(index + 1)]);
    setFocused(row.key);
  };

  return (
    <main className="flex min-h-svh flex-col p-6">
      <Button
        className="self-start no-underline"
        render={<Link to="/dashboard/$organizationId" params={{ organizationId: organization.id }} />}
      >
        Cancel
      </Button>
      <div className="flex w-full flex-1 items-center justify-center py-6">
        {question === "name" ? (
          <Step
            key="name"
            question="What's the event called?"
            hint="Participants see it, and the event's link is made from it."
            progress={progress("name")}
            complete={!!name.trim()}
            error={nameError}
            submit={() => {
              setNameError(undefined);
              setQuestion("topics");
            }}
          >
            {(labelId) => (
              <div className="flex flex-col gap-2">
                <Input
                  aria-labelledby={labelId}
                  autoFocus
                  autoComplete="off"
                  placeholder="Summer Photo Walk"
                  required
                  maxLength={100}
                  value={name}
                  onValueChange={setName}
                />
                {/* min-w-0 lets a long slug truncate instead of widening the page. */}
                {name.trim() && (
                  <p className="flex min-w-0 items-center justify-center gap-1.5 text-sm text-muted-foreground">
                    <IconLink aria-hidden className="size-4 shrink-0" />
                    <span className="sr-only">Link:</span>
                    <span className="truncate">/e/{slugOf(name)}</span>
                  </p>
                )}
              </div>
            )}
          </Step>
        ) : question === "topics" ? (
          <Step
            key="topics"
            question="What will participants photograph?"
            hint="One topic is a single theme. For more, list them in the order participants get them."
            progress={progress("topics")}
            back={() => setQuestion("name")}
            complete={named.length > 0}
            submit={() => setQuestion("window")}
          >
            {(labelId) => (
              <div role="group" aria-labelledby={labelId} className="flex flex-col gap-2 text-left">
                <ol className="flex flex-col gap-2">
                  {topics.map((topic, index) => (
                    <li key={topic.key} className="flex items-center gap-2">
                      <span aria-hidden className="w-5 shrink-0 text-end font-mono text-xs text-muted-foreground">
                        {index + 1}
                      </span>
                      <Input
                        aria-label={`Topic ${index + 1}`}
                        autoFocus={topic.key === focused}
                        autoComplete="off"
                        maxLength={100}
                        className="min-w-0 flex-1"
                        value={topic.name}
                        onValueChange={(name) =>
                          setTopics(topics.map((row) => (row.key === topic.key ? { ...row, name } : row)))
                        }
                        onKeyDown={(e) => {
                          // Enter in a filled row starts the next one; in an empty row it continues.
                          if (e.key === "Enter" && topic.name.trim() && topics.length < maxTopics) {
                            e.preventDefault();
                            addAfter(index);
                          }
                        }}
                      />
                      {topics.length > 1 && (
                        <Button
                          aria-label={`Remove topic ${index + 1}`}
                          onClick={() => setTopics(topics.filter((row) => row.key !== topic.key))}
                        >
                          <IconX aria-hidden />
                        </Button>
                      )}
                    </li>
                  ))}
                </ol>
                <Button
                  className="ms-7 self-start"
                  disabled={topics.length >= maxTopics}
                  onClick={() => addAfter(topics.length - 1)}
                >
                  <IconPlus aria-hidden />
                  Add topic
                </Button>
              </div>
            )}
          </Step>
        ) : question === "window" ? (
          <Step
            key="window"
            question="When can photos be submitted?"
            hint="You can change it later in Settings."
            progress={progress("window")}
            back={() => setQuestion("topics")}
            complete={schedule === "by-hand" || opensAt !== undefined}
            submit={() => {
              if (opensAt && closesAt && closesAt <= opensAt) {
                return "Submissions have to close after they open.";
              }

              setQuestion("review");
            }}
          >
            {(labelId) => (
              <div className="flex flex-col gap-6 text-left">
                <RadioGroup
                  aria-labelledby={labelId}
                  value={schedule}
                  onValueChange={setSchedule}
                  className="flex flex-col gap-3"
                >
                  <label data-slot="label" className="flex items-center gap-2">
                    <Radio value="dates">
                      <RadioIndicator />
                    </Radio>
                    On dates
                  </label>
                  <label data-slot="label" className="flex items-center gap-2">
                    <Radio value="by-hand">
                      <RadioIndicator />
                    </Radio>
                    I'll open and close it myself
                  </label>
                </RadioGroup>
                {schedule === "dates" && (
                  <>
                    <WallClockInput label="Opens" value={opens} onChange={setOpens} />
                    <WallClockInput label="Closes" value={closes} onChange={setCloses} />
                    <p className="-mt-4 text-sm text-muted-foreground">Leave closing empty for no deadline.</p>
                    <TimeZoneCombobox value={timeZone} onChange={setTimeZone} />
                  </>
                )}
              </div>
            )}
          </Step>
        ) : (
          <Step
            key="review"
            question="Ready to create it?"
            hint="It starts as a draft. Publish it when you want participants to enter."
            progress={progress("review")}
            back={() => setQuestion("window")}
            action="Create event"
            complete
            submit={() =>
              create
                .mutateAsync({
                  name: name.trim(),
                  time_zone: timeZone,
                  opens_at: opensAt?.toISOString(),
                  closes_at: closesAt?.toISOString(),
                  topics: named,
                })
                .then(
                  (competition) =>
                    navigate({
                      to: "/dashboard/$organizationId/events/$competitionId",
                      params: { organizationId: organization.id, competitionId: competition.id },
                    }),
                  (error) => {
                    if (isApiError(error, "CompetitionNameTaken")) {
                      setNameError("That name is taken. Try another.");
                      setQuestion("name");

                      return;
                    }

                    return "Couldn't create the event. Try again.";
                  },
                )
            }
          >
            {() => (
              <dl className="flex flex-col divide-y divide-border border-y border-border text-left text-sm">
                <Answer term="Name" edit={() => setQuestion("name")}>
                  {name.trim()}
                </Answer>
                <Answer term={named.length === 1 ? "Topic" : "Topics"} edit={() => setQuestion("topics")}>
                  {named.length === 1 ? (
                    named[0]
                  ) : (
                    <ol className="list-inside list-decimal">
                      {named.map((topic, index) => (
                        // oxlint-disable-next-line react/no-array-index-key -- names can repeat, and the list never reorders here
                        <li key={index}>{topic}</li>
                      ))}
                    </ol>
                  )}
                </Answer>
                <Answer term="Submissions" edit={() => setQuestion("window")}>
                  {opensAt ? (
                    <>
                      Open <span className="font-mono text-xs">{formatIn(opensAt, timeZone)}</span>
                      {closesAt ? (
                        <>
                          {" "}
                          to <span className="font-mono text-xs">{formatIn(closesAt, timeZone)}</span>
                        </>
                      ) : (
                        ", no deadline"
                      )}
                      <span className="block text-muted-foreground">{timeZone.replaceAll("_", " ")}</span>
                    </>
                  ) : (
                    "You open and close them"
                  )}
                </Answer>
              </dl>
            )}
          </Step>
        )}
      </div>
    </main>
  );
}

function Answer({ term, edit, children }: { term: string; edit: () => void; children: ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-3">
      <dt className="w-24 shrink-0 text-muted-foreground">{term}</dt>
      <dd className="flex min-w-0 flex-1 items-start gap-2">
        <div className="min-w-0 flex-1 wrap-anywhere">{children}</div>
        <Button aria-label={`Edit ${term.toLowerCase()}`} onClick={edit}>
          Edit
        </Button>
      </dd>
    </div>
  );
}
