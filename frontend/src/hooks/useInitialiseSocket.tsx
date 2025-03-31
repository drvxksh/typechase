import { useEffect, useState } from "react";
import { ConnectionStatus } from "../types";

/**
 * Custom hook to initialize and manage a WebSocket connection
 *
 * @returns {[WebSocket|null, ConnectionStatus]} The WebSocket instance if connected, null otherwise along with the connection status
 */
export default function useInitialiseSocket(): [
  WebSocket | null,
  ConnectionStatus,
] {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");

  useEffect(() => {
    // create local variables so that we don't include them in the dependency array
    const newSocket = new WebSocket("ws://localhost:3000");
    let connectionStatus: ConnectionStatus = "connecting";

    const timeoutId = setTimeout(() => {
      if (connectionStatus === "connecting") {
        setStatus("failed");
      }
    }, 5000);

    newSocket.onopen = () => {
      setSocket(newSocket);

      connectionStatus = "connected";
      setStatus(connectionStatus);

      clearTimeout(timeoutId);

      // check for exisisting playerId in the local storage
      const existingPlayerId = localStorage.getItem("playerId");

      // communicate the playerId with the backend
      const payload = {
        type: "connect",
        payload: {
          playerId: existingPlayerId ? existingPlayerId : null,
        },
      };

      newSocket.send(JSON.stringify(payload));
    };

    newSocket.onmessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);

      // data.type ensures that we're listening to this event and success ensures that the function was successful
      if (data.type == "connect" && data.payload.success === true) {
        const playerId = data.payload.playerId;
        localStorage.setItem("playerId", playerId);
      }
    };

    newSocket.onerror = () => {
      console.error("Could not connect to the server!");

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
