import { useEffect, useState } from "react";
import { GameStatus } from "../types";
import { useSocketMessaging } from "./useSocketMessaging";
import { toast } from "sonner";
import { useNavigate } from "react-router";

type WebSocketResponse =
  | {
      event: "check_game_id";
      payload: {
        invalidGameId: boolean;
      };
    }
  | {
      event: "error";
      payload: {
        message: string;
      };
    };

/**
 * A custom hook to validate if a given gameid exists or not. If not, navigates to the landing page otherwise returns the state of the game
 */
export default function useValidateGame(gameId: string | undefined) {
  const { socket, status, sendMessage } = useSocketMessaging();
  const [gameStatus, setGameStatus] = useState<GameStatus | null>(null);

  const navigator = useNavigate();

  useEffect(() => {
    if (!socket || status !== "connected") return;

    sendMessage("check_game_id", { gameId });

    const handleMessage = (event: MessageEvent) => {
      const data: WebSocketResponse = JSON.parse(event.data);

      if (data.event === "error") toast.error(data.payload.message);

      if (data.event === "check_game_id") {
        const invalidGameId = data.payload.invalidGameId;

        if (invalidGameId) {
          toast.error("invalid game");
          navigator("/");
        }
      }
    };

    socket.addEventListener("message", handleMessage);

    return () => {
      socket.removeEventListener("message", handleMessage);
    };
  }, [socket, status, sendMessage, gameId, navigator]);

  return { gameStatus };
}
