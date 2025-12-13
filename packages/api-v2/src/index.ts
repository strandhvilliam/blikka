// import { Hono } from "hono"
// import { appRouter } from "./trpc/routers/_app"
// import { handle } from "hono/aws-lambda"
// import { cors } from "hono/cors"
// import { trpcServer } from "@hono/trpc-server"
// import { createTRPCContext } from "./trpc/trpc"

// const app = new Hono()

// // app.use(
// //   cors({
// //     origin: "*",
// //     allowHeaders: ["*"],
// //     allowMethods: ["*"],
// //   })
// // )

// app.use(
//   "/trpc/*",
//   trpcServer({
//     router: appRouter,
//     createContext: createTRPCContext,
//   })
// )

// app.get("/", (c) => c.text("Hello World"))

// export const handler = handle(app)
