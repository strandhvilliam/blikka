import * as OpenApi from "effect/http-api/OpenApi";
import { Api } from "../src/contract.ts";

// Prints the contract's OpenAPI spec; `bun run api:generate` saves it and turns it into the website's types.
console.log(JSON.stringify(OpenApi.fromApi(Api), null, 2));
