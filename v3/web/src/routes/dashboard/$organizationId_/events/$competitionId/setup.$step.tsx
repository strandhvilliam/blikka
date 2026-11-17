import { IconPlus, IconX } from "@tabler/icons-react";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@ui-sdk/react/button";
import { Input } from "@ui-sdk/react/input";
import { Radio, RadioGroup, RadioIndicator } from "@ui-sdk/react/radio";
import { isApiError } from "@/api/client.ts";
import { type Competition, competitionQuery, updateCompetitionMutation } from "@/api/competitions.ts";
import {
  type Topic,
  createTopicMutation,
  deleteTopicMutation,
  topicsQuery,
  updateTopicMutation,
} from "@/api/topics.ts";
import { EventNameStep } from "@/components/EventNameStep.tsx";
import { Step } from "@/components/Step.tsx";
import { TimeZoneCombobox } from "@/components/TimeZoneCombobox.tsx";
import { MinutesInput, TopicOrderRadio } from "@/components/TopicOrder.tsx";
import { WallClockInput } from "@/components/WallClockInput.tsx";
import { type SetupQuestion, isSetupQuestion, setupQuestions } from "@/lib/setupQuestions.ts";
import { fromWallClock, toWallClock } from "@/lib/timeZone.ts";

export const Route = createFileRoute("/dashboard/$organizationId_/events/$competitionId/setup/$step")({
  beforeLoad: async ({ context, params }) => {
    const competition = await context.queryClient.ensureQueryData(competitionQuery(params.competitionId));

    if (!isSetupQuestion(params.step) || !competition || competition.organization_id !== params.organizationId) {
      throw notFound();
    }
  },
  loader: ({ context, params }) => context.queryClient.ensureQueryData(topicsQuery(params.competitionId)),
  component: Setup,
});

type Answers = { topics: number; inSequence: boolean };

type StepProps = {
  competition: Competition;
  progress: [number, number];
  back?: () => void;
  next: (answers?: Answers) => Promise<void>;
};

function Setup() {
  const { organizationId, competitionId, step } = Route.useParams();
  const navigate = useNavigate();
  const { data: competition } = useSuspenseQuery(competitionQuery(competitionId));
  const { data: topics } = useSuspenseQuery(topicsQuery(competitionId));

  if (!competition || !isSetupQuestion(step)) {
    return null;
  }

  const saved = { topics: topics.length, inSequence: competition.topics_in_sequence };
  const questions = setupQuestions(saved);
  const previous = questions[questions.indexOf(step) - 1];

  const go = (to: SetupQuestion | undefined) =>
    to
      ? navigate({
          to: "/dashboard/$organizationId/events/$competitionId/setup/$step",
          params: { organizationId, competitionId, step: to },
        })
      : navigate({ to: "/dashboard/$organizationId/events/$competitionId", params: { organizationId, competitionId } });

  const props: StepProps = {
    competition,
    progress: [questions.indexOf(step) + 1, questions.length],
    back: previous && (() => void go(previous)),
    next: (answers = saved) => {
      const after = setupQuestions(answers);

      return go(after[after.indexOf(step) + 1]);
    },
  };

  return (
    <main className="flex min-h-svh flex-col items-center justify-center p-6">
      {step === "name" ? (
        <NameAnswer key={step} {...props} />
      ) : step === "topics" ? (
        <TopicsAnswer key={step} {...props} topics={topics} />
      ) : step === "order" ? (
        <OrderAnswer key={step} {...props} topics={topics.length} />
      ) : step === "time-limit" ? (
        <TimeLimitAnswer key={step} {...props} />
      ) : (
        <WindowAnswer key={step} {...props} />
      )}
    </main>
  );
}

function NameAnswer({ competition, progress, next }: StepProps) {
  const update = useMutation(updateCompetitionMutation(competition.id));
  const [name, setName] = useState(competition.name);

  return (
    <EventNameStep
      value={name}
      onChange={setName}
      progress={progress}
      submit={async () => {
        if (name.trim() !== competition.name) {
          try {
            await update.mutateAsync({ name: name.trim() });
          } catch (error) {
            return isApiError(error, "CompetitionNameTaken")
              ? "That name is taken. Try another."
              : "Couldn't save the name. Try again.";
          }
        }

        await next();
      }}
    />
  );
}

const maxTopics = 100;

const newRow = () => ({ key: crypto.randomUUID(), id: null, name: "" });

function TopicsAnswer({ competition, progress, back, next, topics }: StepProps & { topics: Array<Topic> }) {
  const create = useMutation(createTopicMutation(competition.id));
  const update = useMutation(updateTopicMutation(competition.id));
  const remove = useMutation(deleteTopicMutation(competition.id));

  const [rows, setRows] = useState<Array<{ key: string; id: string | null; name: string }>>(() =>
    topics.length > 0 ? topics.map((topic) => ({ key: topic.id, id: topic.id, name: topic.name })) : [newRow()],
  );

  const [focused, setFocused] = useState(rows[0]?.key);
  const kept = rows.filter((row) => row.name.trim());

  const addAfter = (index: number) => {
    const row = newRow();
    setRows([...rows.slice(0, index + 1), row, ...rows.slice(index + 1)]);
    setFocused(row.key);
  };

  const save = async () => {
    for (const topic of topics) {
      if (!kept.some((row) => row.id === topic.id)) {
        await remove.mutateAsync(topic.id);
      }
    }

    for (const [index, row] of kept.entries()) {
      const position = index + 1;
      const name = row.name.trim();

      if (row.id === null) {
        const created = await create.mutateAsync(name);
        setRows((current) => current.map((other) => (other.key === row.key ? { ...other, id: created.id } : other)));

        if (created.position !== position) {
          await update.mutateAsync({ id: created.id, position });
        }

        continue;
      }

      const before = topics.find((topic) => topic.id === row.id);

      if (before?.name !== name || before.position !== position) {
        await update.mutateAsync({ id: row.id, name, position });
      }
    }
  };

  return (
    <Step
      question="What will participants photograph?"
      hint="One topic is a single theme. For more, list them in the order participants get them."
      progress={progress}
      back={back}
      skip={() => void next()}
      complete={kept.length > 0}
      submit={async () => {
        try {
          await save();
        } catch {
          return "Couldn't save the topics. Try again.";
        }

        await next({ topics: kept.length, inSequence: competition.topics_in_sequence });
      }}
    >
      {(labelId) => (
        <div role="group" aria-labelledby={labelId} className="flex flex-col gap-2 text-left">
          <ol className="flex flex-col gap-2">
            {rows.map((row, index) => (
              <li key={row.key} className="flex items-center gap-2">
                <span aria-hidden className="w-5 shrink-0 text-end font-mono text-xs text-muted-foreground">
                  {index + 1}
                </span>
                <Input
                  aria-label={`Topic ${index + 1}`}
                  autoFocus={row.key === focused}
                  autoComplete="off"
                  maxLength={100}
                  className="min-w-0 flex-1"
                  value={row.name}
                  onValueChange={(name) =>
                    setRows(rows.map((other) => (other.key === row.key ? { ...other, name } : other)))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && row.name.trim() && rows.length < maxTopics) {
                      e.preventDefault();
                      addAfter(index);
                    }
                  }}
                />
                {rows.length > 1 && (
                  <Button
                    aria-label={`Remove topic ${index + 1}`}
                    onClick={() => setRows(rows.filter((other) => other.key !== row.key))}
                  >
                    <IconX aria-hidden />
                  </Button>
                )}
              </li>
            ))}
          </ol>
          <Button
            className="ms-7 self-start"
            disabled={rows.length >= maxTopics}
            onClick={() => addAfter(rows.length - 1)}
          >
            <IconPlus aria-hidden />
            Add topic
          </Button>
        </div>
      )}
    </Step>
  );
}

function OrderAnswer({ competition, progress, back, next, topics }: StepProps & { topics: number }) {
  const update = useMutation(updateCompetitionMutation(competition.id));
  const [inSequence, setInSequence] = useState(competition.topics_in_sequence);

  return (
    <Step
      question="How do the topics open?"
      hint="You can change it later in Settings."
      progress={progress}
      back={back}
      skip={() => void next()}
      complete
      submit={async () => {
        if (inSequence !== competition.topics_in_sequence) {
          try {
            await update.mutateAsync({ topics_in_sequence: inSequence, minutes_per_topic: null });
          } catch {
            return "Couldn't save how the topics open. Try again.";
          }
        }

        await next({ topics, inSequence });
      }}
    >
      {(labelId) => (
        <div className="text-left">
          <TopicOrderRadio labelledBy={labelId} inSequence={inSequence} onChange={setInSequence} />
        </div>
      )}
    </Step>
  );
}

function TimeLimitAnswer({ competition, progress, back, next }: StepProps) {
  const update = useMutation(updateCompetitionMutation(competition.id));
  const [minutes, setMinutes] = useState(competition.minutes_per_topic);

  return (
    <Step
      question="Time limit per topic?"
      hint="Minutes for each topic, from when it unlocks. When time runs out, the next one opens. Leave it empty for no limit."
      progress={progress}
      back={back}
      skip={() => void next()}
      complete
      submit={async () => {
        if (minutes !== competition.minutes_per_topic) {
          try {
            await update.mutateAsync({ minutes_per_topic: minutes });
          } catch {
            return "Couldn't save the time limit. Try again.";
          }
        }

        await next();
      }}
    >
      {(labelId) => (
        <div className="flex justify-center">
          <MinutesInput labelledBy={labelId} value={minutes} onChange={setMinutes} />
        </div>
      )}
    </Step>
  );
}

function WindowAnswer({ competition, progress, back, next }: StepProps) {
  const update = useMutation(updateCompetitionMutation(competition.id));
  const [timeZone, setTimeZone] = useState(competition.time_zone);
  const wallClock = (iso: string | null) => (iso ? toWallClock(new Date(iso), competition.time_zone) : "");
  const [schedule, setSchedule] = useState<"dates" | "by-hand" | null>(competition.opens_at ? "dates" : null);
  const [opens, setOpens] = useState(wallClock(competition.opens_at));
  const [closes, setCloses] = useState(wallClock(competition.closes_at));
  const opensAt = schedule === "dates" && opens ? fromWallClock(opens, timeZone) : null;
  const closesAt = schedule === "dates" && closes ? fromWallClock(closes, timeZone) : null;

  return (
    <Step
      question="When can photos be submitted?"
      hint="You can change it later in Settings."
      progress={progress}
      back={back}
      skip={() => void next()}
      action="Finish"
      complete={schedule === "by-hand" || opensAt !== null}
      submit={async () => {
        if (opensAt && closesAt && closesAt <= opensAt) {
          return "Submissions have to close after they open.";
        }

        try {
          await update.mutateAsync({
            time_zone: timeZone,
            opens_at: opensAt?.toISOString() ?? null,
            closes_at: closesAt?.toISOString() ?? null,
          });
        } catch {
          return "Couldn't save the times. Try again.";
        }

        await next();
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
  );
}
