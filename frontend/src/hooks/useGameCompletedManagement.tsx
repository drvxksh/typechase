import { useEffect, useState } from "react";
import { useSocketMessaging } from "./useSocketMessaging";

type GameResult = {
  hostId?: string;
  players: {
    id: string;
    name: string;
    wpm: number;
    accuracy: number;
    time: number;
    position: number;
  }[];
};

type WebSocketResponse = {
  event: "get_game_result";
  payload: {
    hostId: string;
    players: GameResult["players"];
  };
};

export default function useGameCompletedManagement() {
  const { socket, sendMessage } = useSocketMessaging();
  const [result, setResult] = useState<GameResult>({
    players: [],
  });

  useEffect(() => {
    if (!socket) {
      return;
    }

    // request for the result of this game
    sendMessage("get_game_result");

    const handleMessage = (event: MessageEvent) => {
      let data: WebSocketResponse | null = null;

      try {
        data = JSON.parse(event.data, (key, value) => {
          if (
            ["wpm", "accuracy", "time", "position"].includes(key) &&
            typeof value === "string"
          ) {
            return Number(value);
          }
          return value;
        });
      } catch (err) {
        console.error("couldn't parse backend response", err);
      }

      if (data) {
        switch (data.event) {
          case "get_game_result": {
            setResult({
              hostId: data.payload.hostId,
              players: data.payload.players
            });
            break;
          }
        }
      }
    };

    socket.addEventListener("message", handleMessage);

    return () => socket.removeEventListener("message", handleMessage);
  }, [socket, sendMessage]);

  const restartGame = () => {
    sendMessage("restart_game");
  };

  const leaveGame = () => {
    sendMessage("leave_game");
  };

  return { result, restartGame, leaveGame };
}
