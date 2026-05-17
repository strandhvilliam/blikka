import { Layer, ManagedRuntime } from "effect"
import { ValidationEngineLayer } from "@blikka/validation"
import { ExifParserLayer } from "@blikka/image-manipulation/exif-parser"

export const clientRuntime = ManagedRuntime.make(
  Layer.mergeAll(ValidationEngineLayer, ExifParserLayer),
)
