"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import mqtt from "mqtt";
import { useTRPC } from "@/trpc/client";
import { useQueryClient } from "@tanstack/react-query";

type RealtimeContextType = {};

const RealtimeContext = createContext<RealtimeContextType | null>(null);

function createConnection(endpoint: string, authorizer: string) {
  return mqtt.connect(
    `wss://${endpoint}/mqtt?x-amz-customauthorizer-name=${authorizer}`,
    {
      protocolVersion: 5,
      manualConnect: true,
      username: "",
      password: process.env.NEXT_PUBLIC_REALTIME_TOKEN ?? "",
      clientId: `client_${window.crypto.randomUUID()}`,
    },
  );
}

export function RealtimeProvider({
  children,
  realtimeConfig,
}: {
  children: ReactNode;
  realtimeConfig: {
    endpoint: string;
    authorizer: string;
    topic: string;
  };
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!window.crypto.randomUUID) {
      return;
    }

    const connection = createConnection(
      realtimeConfig.endpoint,
      realtimeConfig.authorizer,
    );

    connection.on("connect", async () => {
      try {
        await connection.subscribeAsync(realtimeConfig.topic, { qos: 1 });
      } catch (e) {
        console.error(e);
      }
    });
    connection.on("message", (_fullTopic, payload) => {
      const message = new TextDecoder("utf8").decode(new Uint8Array(payload));
      const { query } = JSON.parse(message);

      // maybe use pathfilter instead
      switch (query) {
        case trpc.competitionClasses.pathKey()[0][0]:
          queryClient.invalidateQueries({
            queryKey: trpc.competitionClasses.pathKey(),
          });
          break;
        case trpc.deviceGroups.pathKey()[0][0]:
          queryClient.invalidateQueries({
            queryKey: trpc.deviceGroups.pathKey(),
          });
          break;
        case trpc.marathons.pathKey()[0][0]:
          queryClient.invalidateQueries({
            queryKey: trpc.marathons.pathKey(),
          });
          break;
        case trpc.jury.pathKey()[0][0]:
          queryClient.invalidateQueries({
            queryKey: trpc.jury.pathKey(),
          });
          break;
        case trpc.validations.pathKey()[0][0]:
          queryClient.invalidateQueries({
            queryKey: trpc.validations.pathKey(),
          });
          break;
        case trpc.participants.pathKey()[0][0]:
          queryClient.invalidateQueries({
            queryKey: trpc.participants.pathKey(),
          });
          break;
        case trpc.submissions.pathKey()[0][0]:
          queryClient.invalidateQueries({
            queryKey: trpc.submissions.pathKey(),
          });
          break;
        case trpc.topics.pathKey()[0][0]:
          queryClient.invalidateQueries({
            queryKey: trpc.topics.pathKey(),
          });
          break;
        case trpc.rules.pathKey()[0][0]:
          queryClient.invalidateQueries({
            queryKey: trpc.rules.pathKey(),
          });
          break;
        case trpc.users.pathKey()[0][0]:
          queryClient.invalidateQueries({
            queryKey: trpc.users.pathKey(),
          });
          break;
      }
    });
    connection.on("error", console.error);

    connection.connect();

    return () => {
      connection.end();
    };
  }, [realtimeConfig, trpc, queryClient]);

  return (
    <RealtimeContext.Provider value={{}}>{children}</RealtimeContext.Provider>
  );
}
