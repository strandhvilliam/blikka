import { ExifParser } from "@blikka/image-manipulation"; import { ValidationEngine } from "@blikka/validation"; import { Layer, ManagedRuntime } from "effect"



export const clientRuntime = ManagedRuntime.make(Layer.mergeAll(
  ValidationEngine.layer,
  ExifParser.layer
))