import { randomBytes } from "node:crypto";
import { and, eq, inArray, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { slugOf } from "../src/competitions/schemas.ts";
import * as model from "../src/db/model.ts";

// `bun run db:seed you@example.com`: an organization that has run competitions for a few years, owned
// by that email, in the local database only. Running it again replaces everything it made before,
// and moves the live and upcoming competitions to the current time.

const LOCAL_DATABASE_URL = "postgres://postgres:postgres@localhost:5433/blikka"; // docker-compose.yml
const ORGANIZATION_ID = "5eed0000-0000-7000-8000-000000000001";

const ownerEmail = process.argv[2]?.toLowerCase();

if (!ownerEmail || !ownerEmail.includes("@")) {
  console.error("usage: bun run db:seed <your-email>   (the account that will own the organization)");
  process.exit(1);
}

// Same data every run, apart from the dates that follow now.
let state = 20240601;

const random = () => {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const between = (min: number, max: number) => min + random() * (max - min);

const shuffled = <T>(items: ReadonlyArray<T>) =>
  items
    .map((item) => ({ item, key: random() }))
    .sort((a, b) => a.key - b.key)
    .map(({ item }) => item);

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const now = new Date();
const thisHour = Math.floor(now.getTime() / HOUR) * HOUR;

// The last summer that has passed, so every dated competition below is over.
const year = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
const at = (iso: string) => new Date(iso);

const FIRST_NAMES = [
  "Anna",
  "Erik",
  "Maja",
  "Lars",
  "Sara",
  "Johan",
  "Elin",
  "Oskar",
  "Linnea",
  "Karl",
  "Ida",
  "Gustav",
  "Klara",
  "Axel",
  "Moa",
  "Viktor",
  "Frida",
  "Nils",
  "Hanna",
  "Filip",
  "Wilma",
  "Emil",
  "Alva",
  "Hugo",
  "Saga",
  "Leo",
  "Tove",
  "Anton",
  "Ebba",
  "Isak",
  "Amir",
  "Leila",
  "Yusuf",
  "Sofia",
  "Mateo",
  "Aino",
  "Mikko",
  "Priya",
  "Jonas",
  "Astrid",
  "Kenji",
  "Noor",
  "Lucas",
  "Greta",
  "Ali",
  "Fatima",
  "Tomas",
  "Vera",
];

const LAST_NAMES = [
  "Andersson",
  "Johansson",
  "Karlsson",
  "Nilsson",
  "Eriksson",
  "Larsson",
  "Olsson",
  "Persson",
  "Svensson",
  "Gustafsson",
  "Pettersson",
  "Jonsson",
  "Lindberg",
  "Lindqvist",
  "Berg",
  "Holm",
  "Ek",
  "Sjöberg",
  "Wallin",
  "Engström",
  "Lund",
  "Björk",
  "Hassan",
  "Ahmed",
  "Novak",
  "Korhonen",
  "Virtanen",
  "Rossi",
  "García",
  "Kowalski",
  "Nguyen",
  "Tanaka",
  "Öberg",
  "Åström",
  "Falk",
  "Nyström",
  "Strand",
  "Blom",
];

const TOPIC_NAMES = [
  "Morgonljus",
  "Spegling",
  "Rött",
  "Något som väntar",
  "Linjer",
  "Skuggor",
  "Hemma",
  "I rörelse",
  "Kontrast",
  "Ovanifrån",
  "Det lilla",
  "Vatten",
  "Tre av något",
  "Främling",
  "Gammalt och nytt",
  "Grönt",
  "Symmetri",
  "Bakom glas",
  "Händer",
  "Mönster",
  "Utsikt",
  "Tystnad",
  "Kaos",
  "Fönster",
  "Mat",
  "Trappor",
  "Siffror",
  "Natt",
  "Cirklar",
  "Ensam",
  "Gult",
  "Kvarglömt",
  "Rytm",
  "Hörn",
  "Stad",
  "Djur",
  "Värme",
  "Ingång",
  "Över axeln",
  "Slutet",
];

const DOMAINS = ["example.com", "example.org", "example.net"];

const emailOf = (name: string, domain: string) => `${slugOf(name).replace(/-/g, ".")}@${domain}`;

type Person = { name: string; email: string; hasAccount: boolean };

// Distinct names, so distinct emails. A fifth have an account, the rest enter as guests.
const people: Array<Person> = shuffled(FIRST_NAMES.flatMap((first) => LAST_NAMES.map((last) => `${first} ${last}`)))
  .slice(0, 900)
  .map((name) => ({
    name,
    email: emailOf(name, DOMAINS[Math.floor(random() * DOMAINS.length)]!),
    hasAccount: random() < 0.2,
  }));

const accountPeople = people.filter((person) => person.hasAccount);

// Low indexes come up far more often, so regulars enter year after year.
const pickPeople = (count: number) => {
  const picked = new Set<number>();

  while (picked.size < count) {
    picked.add(Math.floor(people.length * random() ** 1.8));
  }

  return [...picked].map((index) => people[index]!);
};

type CompetitionSeed = {
  name: string;
  description: string;
  timeZone?: string;
  createdAt: Date;
  publishedAt: Date | null;
  opensAt: Date | null;
  closesAt: Date | null;
  deletedAt?: Date;
  topics: number;
  participants: number;
};

const competitionSeeds: Array<CompetitionSeed> = [
  {
    name: `Fotomaraton ${year - 2}`,
    description: "Åtta ämnen, åtta timmar. Ämnena låses upp ett i taget.",
    createdAt: at(`${year - 2}-03-02T09:00:00+01:00`),
    publishedAt: at(`${year - 2}-04-10T12:00:00+02:00`),
    opensAt: at(`${year - 2}-06-08T10:00:00+02:00`),
    closesAt: at(`${year - 2}-06-08T18:00:00+02:00`),
    topics: 8,
    participants: 118,
  },
  {
    name: "Testtävling",
    description: "",
    createdAt: at(`${year - 2}-03-01T20:00:00+01:00`),
    publishedAt: null,
    opensAt: null,
    closesAt: null,
    deletedAt: at(`${year - 2}-03-02T08:30:00+01:00`),
    topics: 2,
    participants: 0,
  },
  {
    name: `Höstljus ${year - 2}`,
    description: "En helg i oktober. Fem ämnen om ljuset när dagarna blir kortare.",
    createdAt: at(`${year - 2}-08-20T18:00:00+02:00`),
    publishedAt: at(`${year - 2}-09-01T08:00:00+02:00`),
    opensAt: at(`${year - 2}-10-12T08:00:00+02:00`),
    closesAt: at(`${year - 2}-10-13T20:00:00+02:00`),
    topics: 5,
    participants: 64,
  },
  {
    name: `Vinterstaden ${year - 1}`,
    description: "En vecka, tre ämnen, så mycket snö som vädret ger.",
    createdAt: at(`${year - 1}-01-10T19:00:00+01:00`),
    publishedAt: at(`${year - 1}-01-20T12:00:00+01:00`),
    opensAt: at(`${year - 1}-02-10T00:00:00+01:00`),
    closesAt: at(`${year - 1}-02-17T00:00:00+01:00`),
    topics: 3,
    participants: 47,
  },
  {
    name: `Lissabon fotovandring ${year - 1}`,
    description: "Klubbresan. Fem ämnen längs vägen från Alfama till Belém.",
    timeZone: "Europe/Lisbon",
    createdAt: at(`${year - 1}-02-25T20:00:00+01:00`),
    publishedAt: at(`${year - 1}-03-05T12:00:00+01:00`),
    opensAt: at(`${year - 1}-04-19T09:00:00+01:00`),
    closesAt: at(`${year - 1}-04-19T19:00:00+01:00`),
    topics: 5,
    participants: 26,
  },
  {
    name: `Fotomaraton ${year - 1}`,
    description: "Tolv ämnen mellan tio och tio. Samling vid Medborgarplatsen.",
    createdAt: at(`${year - 1}-03-01T10:00:00+01:00`),
    publishedAt: at(`${year - 1}-04-01T12:00:00+02:00`),
    opensAt: at(`${year - 1}-06-07T10:00:00+02:00`),
    closesAt: at(`${year - 1}-06-07T22:00:00+02:00`),
    topics: 12,
    participants: 212,
  },
  {
    name: `24 timmar ${year - 1}`,
    description: "Ett ämne i timmen, ett dygn i sträck.",
    createdAt: at(`${year - 1}-08-01T12:00:00+02:00`),
    publishedAt: at(`${year - 1}-08-15T12:00:00+02:00`),
    opensAt: at(`${year - 1}-09-13T12:00:00+02:00`),
    closesAt: at(`${year - 1}-09-14T12:00:00+02:00`),
    topics: 24,
    participants: 83,
  },
  {
    name: `Medlemsutställning ${year}`,
    description: "Lämna in två bilder till vårens utställning. Tre veckor på dig.",
    createdAt: at(`${year}-02-01T18:00:00+01:00`),
    publishedAt: at(`${year}-02-20T12:00:00+01:00`),
    opensAt: at(`${year}-03-01T00:00:00+01:00`),
    closesAt: at(`${year}-03-22T00:00:00+01:00`),
    topics: 2,
    participants: 41,
  },
  {
    name: `Fotomaraton ${year}`,
    description: "Tolv ämnen mellan tio och tio. Det största vi gjort.",
    createdAt: at(`${year}-02-15T10:00:00+01:00`),
    publishedAt: at(`${year}-03-20T12:00:00+01:00`),
    opensAt: at(`${year}-06-13T10:00:00+02:00`),
    closesAt: at(`${year}-06-13T22:00:00+02:00`),
    topics: 12,
    participants: 338,
  },
  {
    name: "Stadsjakten",
    description: "Åtta ämnen i dag. Lämna in innan stängning.",
    createdAt: new Date(thisHour - 30 * DAY),
    publishedAt: new Date(thisHour - 21 * DAY),
    opensAt: new Date(thisHour - 3 * HOUR),
    closesAt: new Date(thisHour + 5 * HOUR),
    topics: 8,
    participants: 154,
  },
  {
    name: "Veckans utmaning",
    description: "Fyra ämnen på en vecka, i din egen takt.",
    createdAt: new Date(thisHour - 10 * DAY),
    publishedAt: new Date(thisHour - 8 * DAY),
    opensAt: new Date(thisHour - 4 * DAY),
    closesAt: new Date(thisHour + 3 * DAY),
    topics: 4,
    participants: 57,
  },
  {
    name: "Nattvandring",
    description: "En kväll med stativ. Vi ses vid Slussen.",
    createdAt: new Date(thisHour - 12 * DAY),
    publishedAt: new Date(thisHour - 5 * DAY),
    opensAt: new Date(thisHour + 18 * DAY),
    closesAt: new Date(thisHour + 18 * DAY + 5 * HOUR),
    topics: 6,
    participants: 23,
  },
  {
    name: `Fotomaraton ${year + 1}`,
    description: "",
    createdAt: new Date(thisHour - 2 * DAY),
    publishedAt: null,
    opensAt: at(`${year + 1}-06-12T10:00:00+02:00`),
    closesAt: at(`${year + 1}-06-12T22:00:00+02:00`),
    topics: 12,
    participants: 0,
  },
  {
    name: "Porträttkväll",
    description: "",
    createdAt: new Date(thisHour - 6 * HOUR),
    publishedAt: null,
    opensAt: null,
    closesAt: null,
    topics: 0,
    participants: 0,
  },
];

// Submissions in topic order, each later than the last, none after now or the close.
const submissionTimes = (topicCount: number, opensAt: Date | null, closesAt: Date | null) => {
  if (!opensAt || opensAt > now || topicCount === 0) {
    return [];
  }

  const end = Math.min(closesAt?.getTime() ?? now.getTime(), now.getTime());
  const live = end === now.getTime();
  const roll = random();
  let count = topicCount;

  if (roll < (live ? 0.12 : 0.07)) {
    count = 0;
  } else if (live) {
    const elapsed = (now.getTime() - opensAt.getTime()) / ((closesAt?.getTime() ?? end) - opensAt.getTime());
    count = Math.min(topicCount, Math.floor(topicCount * elapsed * between(0.5, 1.8)));
  } else if (roll < 0.25) {
    count = 1 + Math.floor(random() * (topicCount - 1));
  }

  const start = opensAt.getTime() + (end - opensAt.getTime()) * between(0, 0.15);
  const span = (end - start) * (live ? 1 : between(0.6, 0.98));
  const gaps = Array.from({ length: count + 1 }, () => between(0.5, 1.5));
  const total = gaps.reduce((sum, gap) => sum + gap, 0);
  let time = start;

  return gaps.slice(0, count).map((gap) => {
    time += (span * gap) / total;
    const createdAt = new Date(time);
    const updatedAt = random() < 0.12 ? new Date(Math.min(time + between(2, 40) * MINUTE, end)) : createdAt;

    return { createdAt, updatedAt };
  });
};

// Admins who joined over the years through invitations, one of whom has since left.
const admins: Array<{ name: string; email: string; joined: Date; left?: Date }> = [
  { name: "Ebba Lindqvist", email: "ebba.lindqvist@example.org", joined: at(`${year - 2}-02-20T10:00:00+01:00`) },
  { name: "Omar Haddad", email: "omar.haddad@example.com", joined: at(`${year - 1}-01-08T18:00:00+01:00`) },
  {
    name: "Johanna Berg",
    email: "johanna.berg@example.net",
    joined: at(`${year - 2}-05-01T12:00:00+02:00`),
    left: at(`${year - 1}-11-03T09:00:00+01:00`),
  },
  { name: "Mikael Strand", email: "mikael.strand@example.com", joined: new Date(thisHour - 9 * DAY) },
];

const pool = new Pool({ connectionString: LOCAL_DATABASE_URL, max: 1 });
const db = drizzle(pool, { schema: model, casing: "snake_case" });

const result = await db.transaction(async (tx) => {
  // Replace what an earlier run made. The seeded users go too, the owner's account stays.
  const competitionIds = tx
    .select({ id: model.competitions.id })
    .from(model.competitions)
    .where(eq(model.competitions.organizationId, ORGANIZATION_ID));

  const participantIds = tx
    .select({ id: model.participants.id })
    .from(model.participants)
    .where(inArray(model.participants.competitionId, competitionIds));

  const [owner] = await tx
    .insert(model.user)
    .values({ name: ownerEmail.split("@")[0]!, email: ownerEmail, emailVerified: true })
    .onConflictDoUpdate({ target: model.user.email, set: { emailVerified: true } })
    .returning();

  await tx.delete(model.submissions).where(inArray(model.submissions.participantId, participantIds));
  await tx.delete(model.participants).where(inArray(model.participants.competitionId, competitionIds));
  await tx.delete(model.topics).where(inArray(model.topics.competitionId, competitionIds));
  await tx.delete(model.competitions).where(eq(model.competitions.organizationId, ORGANIZATION_ID));
  await tx
    .delete(model.organizationInvitations)
    .where(eq(model.organizationInvitations.organizationId, ORGANIZATION_ID));
  await tx.delete(model.organizationMembers).where(eq(model.organizationMembers.organizationId, ORGANIZATION_ID));
  await tx.delete(model.organizations).where(eq(model.organizations.id, ORGANIZATION_ID));

  const seededEmails = [...accountPeople.map((person) => person.email), ...admins.map((admin) => admin.email)];

  await tx.delete(model.user).where(and(inArray(model.user.email, seededEmails), ne(model.user.id, owner!.id)));

  const founded = at(`${year - 2}-02-14T19:00:00+01:00`);

  await tx
    .insert(model.organizations)
    .values({ id: ORGANIZATION_ID, name: "Södermalms Fotoklubb", createdAt: founded, updatedAt: founded });
  await tx
    .insert(model.organizationMembers)
    .values({ organizationId: ORGANIZATION_ID, userId: owner!.id, role: "owner", createdAt: founded });

  for (const admin of admins) {
    const [user] = await tx
      .insert(model.user)
      .values({
        name: admin.name,
        email: admin.email,
        emailVerified: true,
        createdAt: admin.joined,
        updatedAt: admin.joined,
      })
      .returning();

    await tx.insert(model.organizationMembers).values({
      organizationId: ORGANIZATION_ID,
      userId: user!.id,
      role: "admin",
      createdAt: admin.joined,
      deletedAt: admin.left ?? null,
    });
    await tx.insert(model.organizationInvitations).values({
      organizationId: ORGANIZATION_ID,
      email: admin.email,
      invitedBy: owner!.id,
      createdAt: new Date(admin.joined.getTime() - DAY),
      expiresAt: new Date(admin.joined.getTime() + 6 * DAY),
      acceptedAt: admin.joined,
    });
  }

  await tx.insert(model.organizationInvitations).values([
    // Open
    {
      organizationId: ORGANIZATION_ID,
      email: "karin.sjoberg@example.com",
      invitedBy: owner!.id,
      createdAt: new Date(thisHour - 2 * DAY),
      expiresAt: new Date(thisHour + 5 * DAY),
    },
    // Expired, never accepted
    {
      organizationId: ORGANIZATION_ID,
      email: "per.nystrom@example.org",
      invitedBy: owner!.id,
      createdAt: new Date(thisHour - 40 * DAY),
      expiresAt: new Date(thisHour - 33 * DAY),
    },
    // Revoked
    {
      organizationId: ORGANIZATION_ID,
      email: "fel.adress@example.net",
      invitedBy: owner!.id,
      createdAt: new Date(thisHour - 15 * DAY),
      expiresAt: new Date(thisHour - 8 * DAY),
      revokedAt: new Date(thisHour - 15 * DAY + 10 * MINUTE),
    },
  ]);

  // Accounts for the participants who have one, created before their first entry.
  const userIdByEmail = new Map<string, string>();

  const accountRows = await tx
    .insert(model.user)
    .values(
      accountPeople.map((person) => {
        const createdAt = new Date(founded.getTime() + between(0, 400) * DAY);

        return { name: person.name, email: person.email, emailVerified: true, createdAt, updatedAt: createdAt };
      }),
    )
    .returning({ id: model.user.id, email: model.user.email });

  for (const row of accountRows) {
    userIdByEmail.set(row.email, row.id);
  }

  let participantTotal = 0;
  let submissionTotal = 0;

  for (const seed of competitionSeeds) {
    const updatedAt = seed.publishedAt ?? seed.createdAt;

    const [competition] = await tx
      .insert(model.competitions)
      .values({
        organizationId: ORGANIZATION_ID,
        slug: slugOf(seed.name),
        name: seed.name,
        description: seed.description,
        timeZone: seed.timeZone ?? "Europe/Stockholm",
        publishedAt: seed.publishedAt,
        opensAt: seed.opensAt,
        closesAt: seed.closesAt,
        createdAt: seed.createdAt,
        updatedAt,
        deletedAt: seed.deletedAt ?? null,
      })
      .returning();

    if (seed.topics === 0) {
      continue;
    }

    const topics = await tx
      .insert(model.topics)
      .values(
        shuffled(TOPIC_NAMES)
          .slice(0, seed.topics)
          .map((name, index) => ({
            competitionId: competition!.id,
            name,
            position: index + 1,
            createdAt: seed.createdAt,
            updatedAt,
          })),
      )
      .returning();

    if (seed.participants === 0) {
      continue;
    }

    const entries = pickPeople(seed.participants).map((person) => {
      const times = submissionTimes(topics.length, seed.opensAt, seed.closesAt);
      const opensAt = seed.opensAt ?? now;

      // Most sign up in the weeks before, the rest on the day.
      const signedUp =
        random() < 0.6 ? opensAt.getTime() - between(1, 21) * DAY : opensAt.getTime() + between(0, 1) * HOUR;

      const latest = Math.min(times[0]?.createdAt.getTime() ?? Infinity, now.getTime()) - MINUTE;
      const createdAt = new Date(Math.max(Math.min(signedUp, latest), seed.publishedAt!.getTime()));
      const userId = userIdByEmail.get(person.email) ?? null;

      return {
        row: {
          competitionId: competition!.id,
          userId,
          name: person.name,
          email: person.email,
          guestTokenHash: userId ? null : randomBytes(32).toString("hex"),
          createdAt,
          updatedAt: createdAt,
        },
        times,
      };
    });

    const participants = await tx
      .insert(model.participants)
      .values(entries.map((entry) => entry.row))
      .returning({ id: model.participants.id, email: model.participants.email });

    const participantIdByEmail = new Map(participants.map((participant) => [participant.email, participant.id]));

    const submissions = entries.flatMap((entry) =>
      entry.times.map((time, index) => ({
        participantId: participantIdByEmail.get(entry.row.email)!,
        topicId: topics[index]!.id,
        createdAt: time.createdAt,
        updatedAt: time.updatedAt,
      })),
    );

    if (submissions.length > 0) {
      await tx.insert(model.submissions).values(submissions);
    }

    participantTotal += participants.length;
    submissionTotal += submissions.length;
  }

  return { competitions: competitionSeeds.length, participants: participantTotal, submissions: submissionTotal };
});

await pool.end();

console.log(
  `✓ Södermalms Fotoklubb: ${result.competitions} competitions, ${result.participants} participants, ${result.submissions} submissions`,
);

console.log(`  owned by ${ownerEmail}; sign in with that email (the OTP code is logged by alchemy dev)`);
