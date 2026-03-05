import { ExifParser } from "@blikka/image-manipulation/exif-parser"
import { ValidationEngine } from "@blikka/validation"
import { Layer, ManagedRuntime } from "effect"

export const clientRuntime = ManagedRuntime.make(
  Layer.mergeAll(ValidationEngine.layer, ExifParser.layer),
)
