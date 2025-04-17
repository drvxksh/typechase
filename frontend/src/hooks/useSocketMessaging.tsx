import invariant from "tiny-invariant";
import { useWebSocket } from "./useWebSocket";
import { useCallback } from "react";

/**
 * Custom hook for WebSocket messaging functionality
 * @throws when the socket is not initialised or the status !== connected
 */
export function useSocketMessaging(): {
  sendMessage: (eventName: string, payload?: object) => void;
  socket: WebSocket | null;
} {
  const { 0: socket } = useWebSocket();

  const sendMessage = useCallback(
    (eventName: string, payload = {}) => {
      invariant(
        socket,
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
    },
    [socket],
  );

  return {
    sendMessage,
    socket,
  };
}
