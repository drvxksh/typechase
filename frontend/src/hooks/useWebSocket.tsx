import { createContext, useContext } from "react";
import { ConnectionStatus } from "../types";

export const WebSocketContext = createContext<
  [WebSocket | null, ConnectionStatus]
>([null, "connecting"]);

export function useWebSocket() {
  return useContext(WebSocketContext);
}
