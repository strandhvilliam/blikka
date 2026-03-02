import { useEffect } from "react";
import mqtt from "mqtt";

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

export const useSubmissionRealtime = ({
  participantId,
  realtimeConfig,
  onEvent,
}: {
  participantId: number | undefined;
  realtimeConfig: {
    endpoint: string;
    authorizer: string;
    topic: string;
  };
  onEvent: (payload: {
    participantId: string;
    status: string;
    key: string;
  }) => void;
}) => {
  useEffect(() => {
    if (!window.crypto.randomUUID) {
      return;
    }

    if (!participantId) {
      return;
    }

    const connection = createConnection(
      realtimeConfig.endpoint,
      realtimeConfig.authorizer,
    );

    connection.on("connect", async () => {
      try {
        await connection.subscribeAsync(
          `${realtimeConfig.topic}/${participantId}`,
          { qos: 1 },
        );
      } catch (e) {
        console.error(e);
      }
    });
    connection.on("message", (_fullTopic, payload) => {
      const message = new TextDecoder("utf8").decode(new Uint8Array(payload));

      const { participantId, status, key } = JSON.parse(message) as {
        participantId: string;
        status: string;
        key: string;
      };

      onEvent({ participantId, status, key });
    });
    connection.on("error", console.error);

    connection.connect();

    return () => {
      connection.end();
    };
  }, []);

  return null;
};
