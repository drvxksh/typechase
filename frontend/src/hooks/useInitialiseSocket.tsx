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

/** Custom hook to initialize and manage a WebSocket connection */
export default function useInitialiseSocket(): [
  WebSocket | null,
  ConnectionStatus,
] {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");

  const navigator = useNavigate();

  useEffect(() => {
    console.log("initialisation hook invoked");
    // create local variables so that we don't include them in the dependency array
    const newSocket = new WebSocket("ws://localhost:3000");
    let connectionStatus: ConnectionStatus = "connecting";

    const timeoutId = setTimeout(() => {
      if (connectionStatus === "connecting") {
        setStatus("failed");
      }
    }, 5000);

    newSocket.onopen = () => {
      // stop retrying now
      clearTimeout(timeoutId);

      // check for exisisting playerId in the local storage
      const existingPlayerId = localStorage.getItem("playerId");

      // communicate the playerId with the backend
      const payload = {
        event: "connect",
        payload: {
          playerId: existingPlayerId ? existingPlayerId : null,
        },
      };

      newSocket.send(JSON.stringify(payload));
    };

    newSocket.onmessage = (event: MessageEvent) => {
      // TODO only keep the error prone code inside the try catch.
      try {
        const data: WebSocketResponse = JSON.parse(event.data);

        if (data.event === "connect") {
          const playerId = data.payload.playerId;
          localStorage.setItem("playerId", playerId);

          // when the backend is aware about the connection, then consider the current connection as connected
          connectionStatus = "connected";
          setStatus(connectionStatus);
          setSocket(newSocket);

          // if this user is a part of a game, send it back
          if (data.payload.existingGameId)
            navigator(`game/${data.payload.existingGameId}`);
        }

        if (data.event === "error") {
          toast.error(data.payload.message);
        }
      } catch (err) {
        console.error("error while parsing the backend response", err);

        connectionStatus = "failed";
        setStatus(connectionStatus);
      }
    };

    newSocket.onerror = () => {
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
  }, []);

  return [socket, status];
}
