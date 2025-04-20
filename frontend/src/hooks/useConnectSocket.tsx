import { useEffect, useState } from "react";
import { ConnectionStatus } from "../types";
import { useNavigate } from "react-router";
import { toast } from "sonner";

type WebSocketResponse =
  | {
      event: "connect";
      payload: {
        playerId: string;
        existingGameId: string | null;
      };
    }
  | {
      event: "error";
      payload: {
        message: string;
      };
    };

/**
 * Establishes a websocket connection to the backend server.
 * Manages socket instance and connection state.
 * Persists user identification in localStorage.
 */
export default function useConnectSocket(): [
  WebSocket | null,
  ConnectionStatus,
] {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");

  // TODO add a health check for the frontend and backend
  const navigator = useNavigate();

  useEffect(() => {
    const newSocket = new WebSocket("ws://localhost:3000");
    let connectionStatus: ConnectionStatus = "connecting";

    // fail the connection if it was not connected after some given time
    const timeoutId = setTimeout(() => {
      if (connectionStatus === "connecting") {
        setStatus("failed");
      }
    }, 5000);

    newSocket.onopen = () => {
      clearTimeout(timeoutId);

      // fetch the existing playerId
      const existingPlayerId = localStorage.getItem("playerId");

      // connect the backend
      const payload = {
        event: "connect",
        payload: {
          playerId: existingPlayerId ? existingPlayerId : null,
        },
      };

      newSocket.send(JSON.stringify(payload));
    };

    newSocket.onmessage = (event: MessageEvent) => {
      let data: WebSocketResponse | null = null;

      try {
        data = JSON.parse(event.data);
      } catch (err) {
        console.error("couldn't parse the backend response", err);

        connectionStatus = "failed";
        setStatus(connectionStatus);
      }

      if (data) {
        switch (data.event) {
          case "connect": {
            // save the new playerId if it differs from the existing one
            const playerId = data.payload.playerId;
            const existingPlayerId = localStorage.getItem("playerId");

            if (existingPlayerId !== playerId) {
              localStorage.setItem("playerId", playerId);
            }

            // update the state variables
            connectionStatus = "connected";
            setStatus(connectionStatus);
            setSocket(newSocket);

            // redirect the player if it was part in the middle of a game
            if (data.payload.existingGameId) {
              navigator(`/game/${data.payload.existingGameId}`);
            }

            break;
          }
          case "error": {
            toast.error(data.payload.message);

            break;
          }
        }
      } else {
        console.error("The server returned a null response");

        connectionStatus = "failed";
        setStatus(connectionStatus);
      }
    };

    newSocket.onerror = () => {
      // the error is logged anyways when the socket errors, so directly updating the variables without logging
      connectionStatus = "failed";
      setStatus(connectionStatus);

      clearTimeout(timeoutId);
    };

    return () => {
      clearTimeout(timeoutId);

      if (newSocket) {
        newSocket.close();
      }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [socket, status];
}
