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
