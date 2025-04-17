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
      event: "start_game";
    }
  | {
      event: "leave_game";
    };

/** Custom hook to fetch the status of the game. redirects to the landing page if the gameId is invalid */
export default function useGameStatus(gameId: string | undefined) {
  const { socket, sendMessage } = useSocketMessaging();
  const [gameStatus, setGameStatus] = useState<GameStatus | null>(null);

  const navigator = useNavigate();

  useEffect(() => {
    console.log("game status hook invoked");
    if (!socket) {
      navigator("/");
      return;
    }

    sendMessage("check_game_id", { gameId });

    const handleMessage = (event: MessageEvent) => {
      const data: WebSocketResponse = JSON.parse(event.data);

      if (data.event === "check_game_id") {
        const invalidGameId = data.payload.invalidGameId;

        if (invalidGameId) {
          toast.error("invalid game");
          navigator("/");
        } else {
          // this game is valid, the starting state of this game would be waiting
          setGameStatus(GameStatus.WAITING);
        }
      }
    };

    socket.addEventListener("message", handleMessage);

    return () => {
      socket.removeEventListener("message", handleMessage);
    };
  }, [socket, sendMessage, gameId]);

  return { gameStatus };
}
