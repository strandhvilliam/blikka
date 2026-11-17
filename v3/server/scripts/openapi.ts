import * as OpenApi from "effect/http-api/OpenApi";
import { Api } from "../src/contract.ts";

console.log(JSON.stringify(OpenApi.fromApi(Api), null, 2));
