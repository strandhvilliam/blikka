import * as Schema from "effect/Schema";

export const Competition = Schema.Struct({
  id: Schema.String,
  organization_id: Schema.String,
  slug: Schema.String,
  name: Schema.String,
});
export type Competition = typeof Competition.Type;

export const CompetitionName = Schema.Trim.check(Schema.isNonEmpty(), Schema.isMaxLength(100));

// "Malmö Fotomaraton 2026!" -> "malmo-fotomaraton-2026".
// shortcut: a name with no Latin letters or digits gives "event", so only one such name can exist; keep Unicode letters in the slug once that bites.
export const slugOf = (name: string): string =>
  name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 60)
    .replace(/^-+|-+$/g, "") || "event";

// The slug comes from the name and is unique across all organizations, deleted competitions
// included, so a taken slug is a taken name. Names have no constraint of their own.
export class CompetitionNameTaken extends Schema.TaggedError<CompetitionNameTaken>()(
  "CompetitionNameTaken",
  {},
  { httpApiStatus: 409 },
) {}

// Also for competitions in organizations the caller can't read, so outsiders can't tell whether one exists.
export class CompetitionNotFound extends Schema.TaggedError<CompetitionNotFound>()(
  "CompetitionNotFound",
  {},
  { httpApiStatus: 404 },
) {}
