    const byCameraLoadTestTask = shouldCreateLocalLoadTestTask
      ? new sst.aws.Task("ByCameraLoadTestTask", {
          cluster,
          image: {
            dockerfile: "/.local/load-testing/Dockerfile",
          },
          environment: compactEnv({
            TARGET_BASE_URL: process.env.LOAD_TEST_TARGET_BASE_URL,
            MARATHON_DOMAIN: process.env.LOAD_TEST_MARATHON_DOMAIN,
            X_MARATHON_DOMAIN: process.env.LOAD_TEST_X_MARATHON_DOMAIN,
            DEVICE_GROUP_ID: process.env.LOAD_TEST_DEVICE_GROUP_ID,
            TEST_PHONE_PREFIX: process.env.LOAD_TEST_PHONE_PREFIX,
            MAX_FINALIZATION_WAIT_MS: process.env.LOAD_TEST_MAX_FINALIZATION_WAIT_MS,
            RAMP_PROFILE: process.env.LOAD_TEST_RAMP_PROFILE ?? "smoke",
            TEST_CASE: process.env.LOAD_TEST_CASE ?? "happy-path",
            PRODUCTION_ACK:
              process.env.LOAD_TEST_PRODUCTION_ACK ?? "I_UNDERSTAND_PRODUCTION_LOAD_TEST",
          }),
        })
      : null



    const localLoadTestDockerfilePath = "./.local/load-testing/Dockerfile"
    const shouldCreateLocalLoadTestTask =
      process.env.ENABLE_LOCAL_LOAD_TEST_TASK === "1" && existsSync(localLoadTestDockerfilePath)
