import * as Schema from 'effect/Schema'

export const Organization = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
})

export type Organization = typeof Organization.Type

export const OrganizationName = Schema.Trim.check(Schema.isNonEmpty(), Schema.isMaxLength(100))

// Also for non-members, so outsiders can't tell whether an organization exists.
export class OrganizationNotFound extends Schema.TaggedError<OrganizationNotFound>()(
  'OrganizationNotFound',
  {},
  { httpApiStatus: 404 },
) {}
