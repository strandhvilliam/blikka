import { realtime } from "@/lib/realtime"

export const POST = async () => {
  await realtime.emit("notification.alert", "hello world!")

  return new Response("OK")
}