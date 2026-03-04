import { Schema, SchemaTransformation } from "effect"

export const NumberToStringSchema = Schema.Number.pipe(
  Schema.decodeTo(
    Schema.String,
    SchemaTransformation.transform({
      encode: (s) => Number(s),
      decode: (n) => String(n),
    }),
  ),
)
