import { ReactNode } from "react";
import { WebSocketContext } from "../hooks/useWebSocket";

type ProviderProps = {
  websocket: WebSocket | null;
  children: ReactNode;
};

export function WebSocketProvider({ websocket, children }: ProviderProps) {
  return (
    <WebSocketContext.Provider value={websocket}>
      {children}
    </WebSocketContext.Provider>
  );
}
