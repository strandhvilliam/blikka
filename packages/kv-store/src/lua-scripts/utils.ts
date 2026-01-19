import { Schema } from "effect";

export const NumberToStringSchema = Schema.transform(Schema.Number, Schema.String, 
  { 
  encode: (s) => Number(s), 
  decode: (n) => String(n)
})