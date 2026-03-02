// event-concurrency-test.js
import http from "k6/http"
import { check, sleep } from "k6"

export let options = {
  stages: [
    // { duration: "5s", target: 50 },
    // { duration: "5s", target: 200 },
    // { duration: "10s", target: 600 },
    { duration: "30s", target: 1000 },
    { duration: "15s", target: 500 },
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<1000"], // 95% of requests < 1s
    http_req_failed: ["rate<0.01"], // <1% errors
  },
}

let logged = false

export default function () {
  const url = __ENV.LOAD_TEST_URL || "http://localhost:3000"

  //   const payload = JSON.stringify({
  //     id: 1,
  //     jsonrpc: "2.0",
  //     method: "query",
  //     params: { input: { name: "test" } },
  //   })

  //   const params = {
  //     headers: { "Content-Type": "application/json" },
  //   }

  let res = http.get(url)

  check(res, {
    "status is 200": (r) => r.status === 200,
    "latency < 1s": (r) => r.timings.duration < 1000,
  })

  // Optional: small sleep to simulate user think time
  sleep(1)
}
