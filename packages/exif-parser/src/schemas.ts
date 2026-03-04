import { Schema } from "effect"

// const CommonExifSchema = Schema.Struct({
//   // Camera info
//   Make: Schema.optional(Schema.String),
//   Model: Schema.optional(Schema.String),
//   Software: Schema.optional(Schema.String),

//   // Lens info
//   LensMake: Schema.optional(Schema.String),
//   LensModel: Schema.optional(Schema.String),

//   // Exposure
//   ExposureTime: Schema.optional(Schema.Number),
//   FNumber: Schema.optional(Schema.Number),
//   ISOSpeedRatings: Schema.optional(Schema.Number),
//   FocalLength: Schema.optional(Schema.Number),

//   // Image properties
//   Orientation: Schema.optional(Schema.Number),

//   // Timestamps
//   DateTimeOriginal: Schema.optional(Schema.Date),
//   CreateDate: Schema.optional(Schema.Date),
//   ModifyDate: Schema.optional(Schema.Date),

//   // GPS (can strip these out separately if needed)
//   GPSLatitude: Schema.optional(Schema.Number),
//   GPSLongitude: Schema.optional(Schema.Number),
//   GPSAltitude: Schema.optional(Schema.Number),
//   GPSLatitudeRef: Schema.optional(Schema.String),
//   GPSLongitudeRef: Schema.optional(Schema.String),
// })

export const ExifSchema = Schema.Record(Schema.String, Schema.Unknown)

export type ExifData = typeof ExifSchema.Type
