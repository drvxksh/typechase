import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useSocketMessaging } from "./useSocketMessaging";

type WebSocketResponse = {
  event: "join_game" | "create_game";
  payload: {
    gameId: string;
  };
};

/**
 * Manages game room operations via WebSocket.
 * Handles the creation of new game rooms and joining existing ones, redirecting as required.
 */
export default function useGamePortal() {
  const { socket, sendMessage } = useSocketMessaging();
  const navigator = useNavigate();

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      let data: WebSocketResponse | null = null;

      try {
        data = JSON.parse(event.data);
      } catch (err) {
        console.error("couldn't parse the backend response", err);
      }

      if (data?.event === "create_game" || data?.event === "join_game") {
        navigator(`/game/${data.payload.gameId}`);
      }
    };

    socket?.addEventListener("message", handleMessage);

    return () => {
      socket?.removeEventListener("message", handleMessage);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  const createGame = () => {
    sendMessage("create_game");
  };

  const joinGame = (gameId: string) => {
    sendMessage("join_game", { gameId });
  };

  return { createGame, joinGame };
}
