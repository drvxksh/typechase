import invariant from "tiny-invariant";
import { useWebSocket } from "./useWebSocket";
import { useCallback } from "react";

/**
 * Messaging wrapper for sending websocket events/messages
 * @throws when the socket is not initialised or the status !== connected
 */
export function useSocketMessaging(): {
  sendMessage: (eventName: string, payload?: object) => void;
  socket: WebSocket | null;
} {
  const { 0: socket } = useWebSocket();

  // memoise the function so that it doesn't cause re-renders if included in dependency arrays
  const sendMessage = useCallback(
    (eventName: string, payload = {}) => {
      invariant(
        socket,
        "The socket was not connected before sending the message",
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
