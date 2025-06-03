import { createContext, useContext } from "react";
import { ConnectionStatus } from "../types";

export const WebSocketContext = createContext<
  [WebSocket | null, ConnectionStatus, string | null]
>([null, "connecting", null]);

/** Returns the websocket instance and the status of the connection */
export function useWebSocket() {
  return useContext(WebSocketContext);
}
