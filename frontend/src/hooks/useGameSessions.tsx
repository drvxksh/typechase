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
 * Custom hook for managing game room operations via WebSocket.
 * Handles the creation of new game rooms and joining existing ones,
 * automatically processing WebSocket responses and navigating accordingly.
 */
export default function useGameSessions(): {
  createGame: () => void;
  joinGame: (gameId: string) => void;
} {
  const { socket, sendMessage } = useSocketMessaging();
  const navigator = useNavigate();

  useEffect(() => {
    console.log("game session hook invoked");
    if (!socket) return;

    const handleMessage = (event: MessageEvent) => {
      const data: WebSocketResponse = JSON.parse(event.data);

      // navigate to the game if it was a success
      if (data.event === "create_game" || data.event === "join_game") {
        const gameId = data.payload.gameId;

        navigator(`/game/${gameId}`);
      }
    };

    socket.addEventListener("message", handleMessage);

    return () => {
      socket.removeEventListener("message", handleMessage);
    };
  }, [socket]);

  const createGame = () => {
    sendMessage("create_game");
  };

  const joinGame = (gameId: string) => {
    sendMessage("join_game", { gameId });
  };

  return { createGame, joinGame };
}
