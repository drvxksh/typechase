import { createContext, useContext } from "react";
import { ConnectionStatus } from "../types";

export const WebSocketContext = createContext<
  [WebSocket | null, ConnectionStatus]
>([null, "connecting"]);

/** Returns the websocket instance and the status of the connection */
export function useWebSocket() {
  return useContext(WebSocketContext);
}
