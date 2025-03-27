import { createContext, useContext } from "react";

export const WebSocketContext = createContext<WebSocket | null>(null);

export function useWebSocket() {
  return useContext(WebSocketContext);
}
