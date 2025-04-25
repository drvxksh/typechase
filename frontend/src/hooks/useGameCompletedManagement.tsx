import { useEffect, useState } from "react";
import { useSocketMessaging } from "./useSocketMessaging";

type GameResult = {
  players: {
    id: string;
    name: string;
    wpm: string;
    accuracy: string;
    time: string;
    position: string;
  }[];
};

type WebSocketResponse = {
  event: "get_game_result";
  payload: GameResult;
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
        data = JSON.parse(event.data);
      } catch (err) {
        console.error("couldn't parse backend response", err);
      }

      if (data) {
        switch (data.event) {
          case "get_game_result": {
            setResult(data.payload);
            break;
          }
        }
      }
    };

    socket.addEventListener("message", handleMessage);

    return socket.removeEventListener("message", handleMessage);
  }, [socket, sendMessage]);

  const restartGame = sendMessage("restart_game");

  const leaveGame = sendMessage("leave_game");

  return { result, restartGame, leaveGame };
}
