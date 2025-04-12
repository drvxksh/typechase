import invariant from "tiny-invariant";
import { useWebSocket } from "./useWebSocket";
import { ConnectionStatus } from "../types";

/**
 * Custom hook for WebSocket messaging functionality
 * @throws when the socket is not initialised or the status !== connected
 */
export function useSocketMessaging(): {
  sendMessage: (eventName: string, payload?: object) => void;
  socket: WebSocket | null;
  status: ConnectionStatus;
} {
  const [socket, status] = useWebSocket();

  const sendMessage = (eventName: string, payload = {}) => {
    invariant(
      status === "connected" && socket,
      "Cannot perform socket action before initialising the socket connection",
    );

    if (socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          event: eventName,
          payload,
        }),
      );
    }
  };

  return {
    sendMessage,
    socket,
    status,
  };
}
