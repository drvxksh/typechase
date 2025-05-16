import { useEffect, useState } from "react";
import { useSocketMessaging } from "./useSocketMessaging";

type WebSocketResponse = {
  event: "game_starting_countdown";
  payload: {
    count: number;
  };
};

export default function useGameStartingManagement() {
  const { socket } = useSocketMessaging();
  const [count, setCount] = useState<number>();

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      let data: WebSocketResponse | null = null;

      try {
        data = JSON.parse(event.data);
      } catch (err) {
        console.error("couldn't parse the backend response", err);
      }

      if (data) {
        switch (data.event) {
          case "game_starting_countdown": {
            setCount(data.payload.count);
          }
        }
      }
    };

    socket.addEventListener("message", handleMessage);

    return () => {
      socket.removeEventListener("message", handleMessage);
    };
  }, [socket]);

  return { count };
}
