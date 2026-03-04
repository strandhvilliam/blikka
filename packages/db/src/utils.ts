import { getColumns, sql, type InferInsertModel } from "drizzle-orm"
import { type PgUpdateSetSource, type PgTable, getTableConfig } from "drizzle-orm/pg-core"
import { Schema } from "effect"

export class DbError extends Schema.TaggedErrorClass<DbError>()(
  "DbError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {
}

export function getDefaultRuleConfigs(
  marathonId: number,
  { startDate, endDate }: { startDate: string | null; endDate: string | null },
) {
  return [
    {
      ruleKey: "max_file_size",
      marathonId,
      enabled: false,
      severity: "error",
      params: {
        maxBytes: 1024 * 1024 * 5,
      },
    },
    {
      ruleKey: "allowed_file_types",
      marathonId,
      enabled: false,
      severity: "error",
      params: {
        allowedFileTypes: ["jpg"],
      },
    },
    {
      ruleKey: "within_timerange",
      marathonId,
      enabled: false,
      severity: "error",
      params: {
        start: startDate ?? "",
        end: endDate ?? "",
      },
    },
    {
      ruleKey: "same_device",
      marathonId,
      enabled: false,
      severity: "error",
      params: null,
    },
    {
      ruleKey: "modified",
      marathonId,
      enabled: false,
      severity: "error",
      params: null,
    },
    {
      ruleKey: "strict_timestamp_ordering",
      marathonId,
      enabled: false,
      severity: "error",
      params: null,
    },
  ]
}

export function conflictUpdateSetAllColumns<
  T extends PgTable,
  E extends readonly (keyof InferInsertModel<T>)[],
>(table: T, except?: E): PgUpdateSetSource<T> {
  const columns = getColumns(table)
  const config = getTableConfig(table)
  const { name: tableName } = config
  const conflictUpdateSet = Object.entries(columns).reduce(
    (acc, [columnName, columnInfo]) => {
      if (except && except.includes(columnName as E[number])) {
        return acc
      }
      // @ts-expect-error
      acc[columnName] = sql.raw(
        `COALESCE("excluded"."${columnInfo.name}", "${tableName}"."${columnInfo.name}")`,
      )
      return acc
    },
    {},
  ) as PgUpdateSetSource<T>
  return conflictUpdateSet
}
