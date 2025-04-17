import { useEffect, useState } from "react";
import { GameStatus } from "../types";
import { useSocketMessaging } from "./useSocketMessaging";
import { toast } from "sonner";
import { useNavigate } from "react-router";

type WebSocketResponse =
  | {
      event: "check_game_id";
      payload: {
        isGameInvalid: boolean;
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
    if (!socket) {
      navigator("/");
      return;
    }

    sendMessage("check_game_id", { gameId });

    const handleMessage = (event: MessageEvent) => {
      let data: WebSocketResponse | null = null;

      try {
        data = JSON.parse(event.data);
      } catch (err) {
        console.error("couldn't parse the backend response", err);
      }

      if (data) {
        switch (data.event) {
          case "check_game_id": {
            const isGameInvalid = data.payload.isGameInvalid;

            if (isGameInvalid) {
              toast.error("Invalid game");
              navigator("/");
            } else {
              setGameStatus(GameStatus.WAITING);
            }

            break;
          }
        }
      }
    };

    socket.addEventListener("message", handleMessage);

    return () => {
      socket.removeEventListener("message", handleMessage);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, sendMessage, gameId]);

  return { gameStatus };
}
