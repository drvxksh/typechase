import { useEffect } from "react";
import { useWebSocket } from "./useWebSocket";
import invariant from "tiny-invariant";
import { toast } from "sonner";
import { useNavigate } from "react-router";

/**
 * Custom hook for managing game room operations via WebSocket.
 * Handles the creation of new game rooms and joining existing ones,
 * automatically processing WebSocket responses and navigating accordingly.
 *
 * @returns {Object} Object containing room management functions
 * @returns {Function} createGame - Function to create a new game room
 * @returns {Function} joinGame - Function to join an existing game room by ID
 */
export default function useGameManagement(): {
  createGame: () => void;
  joinGame: (gameId: string) => void;
} {
  const [socket, status] = useWebSocket();
  const navigator = useNavigate();

  // possible types of the websocket response that this hook is responsible for
  type WebSocketResponse =
    | {
        event: "join_game" | "create_game";
        payload: {
          gameId: string;
        };
      }
    | {
        event: "error";
        payload: {
          message: string;
        };
      };

  useEffect(() => {
    if (!socket || status !== "connected") return;

    const handleMessage = (event: MessageEvent) => {
      const data: WebSocketResponse = JSON.parse(event.data);

      // navigate to the game if it was a success
      if (data.event === "create_game" || data.event === "join_game") {
        const gameId = data.payload.gameId;

        navigator(`/game/${gameId}`);
      }

      // or toast in case of an error
      if (data.event === "error") {
        toast.error(data.payload.message);
      }
    };

    socket.addEventListener("message", handleMessage);

    return () => {
      socket.removeEventListener("message", handleMessage);
    };
  }, [socket, status, navigator]);

  const createGame = () => {
    // ensure that the socket is set up properly. an invariant takes in the conditions that we want to be ensured and errors out otherwise
    invariant(
      status === "connected" && socket,
      "Cannot create a game before initialising the socket connection",
    );

    // the socket can error if the socket was not setup so we check that and avoid the try catch
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          event: "create_game",
          payload: {}, // the playerId is fetched from the socket client in the backend
        }),
      );
    }
  };

  const joinGame = (gameId: string) => {
    invariant(
      status === "connected" && socket,
      "Cannot join a game before initialising the socket connection",
    );

    if (socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          event: "join_game",
          payload: {
            gameId,
          },
        }),
      );
    }
  };

  return { createGame, joinGame };
}
