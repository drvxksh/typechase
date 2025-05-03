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
      event: "game_starting";
    }
  | {
      event: "game_start";
      payload: {
        message: string;
      };
    }
  | {
      event: "leave_game";
    }
  | {
      event: "game_restarting";
      payload: {
        newGameId: string;
      };
    }
  | {
      event: "finish_game";
    };

/** Custom hook to fetch the status of the game. redirects to the landing page if the gameId is invalid */
export default function useGameStatus(gameId: string | undefined) {
  const { socket, sendMessage } = useSocketMessaging();
  const [gameStatus, setGameStatus] = useState<GameStatus | null>(null);

  const navigator = useNavigate();

  useEffect(() => {
    if (!socket) {
      // toast.error("The server is down!");
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
          case "game_starting": {
            setGameStatus(GameStatus.STARTING);
            break;
          }
          case "game_start": {
            setGameStatus(GameStatus.IN_PROGRESS);
            break;
          }
          case "game_restarting": {
            const newGameId = data.payload.newGameId;
            // redirect to the new game
            navigator(`/game/${newGameId}`);
            break;
          }
          case "finish_game": {
            setGameStatus(GameStatus.COMPLETED);
            break;
          }
          case "leave_game": {
            navigator("/");
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
